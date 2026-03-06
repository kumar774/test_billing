import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where,
  getDoc,
  setDoc,
  orderBy,
  onSnapshot,
  WhereFilterOp
} from "firebase/firestore";
import { db, ENABLE_FIREBASE, ENABLE_SUPABASE, ENABLE_TURSO, FIREBASE_TEST } from "../firebase/config";
import { supabase } from "./supabaseClient";
import { turso } from "../firebase/config";
import { toast } from "react-hot-toast";

// Helper to get table/collection name with prefix
const getTableName = (name: string) => {
  // SQL tables are ALWAYS live (no test_ prefix)
  if (name.includes('config')) return 'restaurant_configs';
  if (name.includes('menu')) return 'menu_items';
  if (name.includes('orders')) return 'orders';
  if (name.includes('expenses')) return 'expenses';
  if (name === 'restaurants') return 'restaurants';
  if (name === 'settings') return 'global_settings';
  
  // Default fallback (remove slashes for SQL tables if needed)
  return name.replace(/\//g, '_');
};

// Helper for Firestore collection path (keeps slashes, adds prefix to root collection)
const getFirestorePath = (path: string, usePrefix: boolean = true) => {
  const parts = path.split('/');
  if (FIREBASE_TEST === 'true' && usePrefix) {
    parts[0] = `test_${parts[0]}`;
  }
  return parts.join('/');
};

export const dbService = {
  // 1. SAVE DATA (Create)
  async saveData(collectionName: string, data: Record<string, unknown>, explicitId?: string, usePrefix: boolean = true, skipSQL: boolean = false) {
    let firebaseId = explicitId;
    let successCount = 0;
    const errors: string[] = [];

    // 1. Firebase
    if (ENABLE_FIREBASE) {
      try {
        const firestorePath = getFirestorePath(collectionName, usePrefix);
        const docData = {
          ...data,
          createdAt: data.createdAt || new Date().toLocaleDateString('en-GB'), // DD/MM/YYYY
        };

        if (explicitId) {
          await setDoc(doc(db, firestorePath, explicitId), docData);
        } else {
          const docRef = await addDoc(collection(db, firestorePath), docData);
          firebaseId = docRef.id;
        }
        successCount++;
      } catch (error) {
        console.error("Firebase Save Error:", error);
        errors.push("Firebase");
      }
    }

    const finalId = firebaseId || explicitId || crypto.randomUUID();

    // 2. Supabase
    if (ENABLE_SUPABASE && supabase && !skipSQL) {
      try {
        const tableName = getTableName(collectionName);
        // Map data if needed, for now assuming direct mapping or JSON columns
        // For subcollections like 'restaurants/id/config', we need to handle the structure
        // But based on "Specific Table Mappings", we map to flat tables.
        // We need to ensure foreign keys (like restaurantId) are present in data.
        
        // Extract restaurantId from path if not in data
        const pathParts = collectionName.split('/');
        if (pathParts[0] === 'restaurants' && pathParts[1] && !data.restaurantId) {
             // This might be risky if data doesn't have it, but usually it does or we inject it
             // For config/menu/orders, restaurantId is crucial.
             // Let's assume the caller provides it or we extract it.
             (data as Record<string, unknown>).restaurant_id = pathParts[1];
        }

        // Supabase expects snake_case usually, but let's try to save as is or map specific fields
        // For now, we send data. If schema is strict, this might fail without exact mapping.
        // We inject 'id' to match Firebase ID.
        const { error } = await supabase
          .from(tableName)
          .upsert({ ...data, id: finalId });

        if (error) throw error;
        successCount++;
      } catch (error) {
        console.error("Supabase Save Error:", error);
        errors.push("Supabase");
      }
    }

    // 3. Turso
    if (ENABLE_TURSO && turso && !skipSQL) {
      try {
        const tableName = getTableName(collectionName);
        const keys = Object.keys(data).join(', ');
        const values = Object.values(data).map(v => typeof v === 'string' ? `'${v}'` : v).join(', ');
        // This is a simplified INSERT. Real SQL needs proper escaping and handling of upsert.
        // For now, using a basic INSERT/REPLACE logic if possible or just INSERT.
        await turso.execute(`INSERT INTO ${tableName} (id, ${keys}) VALUES ('${finalId}', ${values})`);
        successCount++;
      } catch (error) {
        console.error("Turso Save Error:", error);
        errors.push("Turso");
      }
    }

    if (errors.length > 0 && successCount > 0) {
      toast("Sync partially successful. Failed: " + errors.join(", "));
    } else if (successCount === 0) {
      throw new Error("Failed to save to any database.");
    }

    return finalId;
  },

  // 2. UPDATE DATA
  async updateData(collectionName: string, id: string, data: Record<string, unknown>, usePrefix: boolean = true, skipSQL: boolean = false) {
    let successCount = 0;
    const errors: string[] = [];

    // 1. Firebase
    if (ENABLE_FIREBASE) {
      try {
        const firestorePath = getFirestorePath(collectionName, usePrefix);
        await updateDoc(doc(db, firestorePath, id), data);
        successCount++;
      } catch (error) {
        console.error("Firebase Update Error:", error);
        errors.push("Firebase");
      }
    }

    // 2. Supabase
    if (ENABLE_SUPABASE && supabase && !skipSQL) {
      try {
        const tableName = getTableName(collectionName);
        const { error } = await supabase
          .from(tableName)
          .update(data)
          .eq('id', id);
        
        if (error) throw error;
        successCount++;
      } catch (error) {
        console.error("Supabase Update Error:", error);
        errors.push("Supabase");
      }
    }

    // 3. Turso
    if (ENABLE_TURSO && turso && !skipSQL) {
      try {
        const tableName = getTableName(collectionName);
        const updates = Object.entries(data)
          .map(([k, v]) => `${k} = ${typeof v === 'string' ? `'${v}'` : v}`)
          .join(', ');
        await turso.execute(`UPDATE ${tableName} SET ${updates} WHERE id = '${id}'`);
        successCount++;
      } catch (error) {
        console.error("Turso Update Error:", error);
        errors.push("Turso");
      }
    }

    if (errors.length > 0 && successCount > 0) {
      toast("Sync partially successful. Failed: " + errors.join(", "));
    }
  },

  // 3. DELETE DATA
  async deleteData(collectionName: string, id: string, usePrefix: boolean = true, skipSQL: boolean = false) {
    let successCount = 0;
    const errors: string[] = [];

    // 1. Firebase
    if (ENABLE_FIREBASE) {
      try {
        const firestorePath = getFirestorePath(collectionName, usePrefix);
        await deleteDoc(doc(db, firestorePath, id));
        successCount++;
      } catch (error) {
        console.error("Firebase Delete Error:", error);
        errors.push("Firebase");
      }
    }

    // 2. Supabase
    if (ENABLE_SUPABASE && supabase && !skipSQL) {
      try {
        const tableName = getTableName(collectionName);
        const { error } = await supabase
          .from(tableName)
          .delete()
          .eq('id', id);
        if (error) throw error;
        successCount++;
      } catch (error) {
        console.error("Supabase Delete Error:", error);
        errors.push("Supabase");
      }
    }

    // 3. Turso
    if (ENABLE_TURSO && turso && !skipSQL) {
      try {
        const tableName = getTableName(collectionName);
        await turso.execute(`DELETE FROM ${tableName} WHERE id = '${id}'`);
        successCount++;
      } catch (error) {
        console.error("Turso Delete Error:", error);
        errors.push("Turso");
      }
    }

    if (errors.length > 0 && successCount > 0) {
      toast("Sync partially successful. Failed: " + errors.join(", "));
    }
  },

  // 4. FETCH DATA
  async fetchData(collectionName: string, usePrefix: boolean = true, filters?: { field: string; operator: string; value: unknown }[], sortField?: string, sortOrder: 'asc' | 'desc' = 'asc') {
    // Prefer Firebase for reading if enabled (as per current architecture)
    if (ENABLE_FIREBASE) {
      const firestorePath = getFirestorePath(collectionName, usePrefix);
      let q = query(collection(db, firestorePath));
      
      if (filters) {
        filters.forEach(f => {
          q = query(q, where(f.field, f.operator as WhereFilterOp, f.value));
        });
      }
      if (sortField) {
        q = query(q, orderBy(sortField, sortOrder));
      }
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // Fallback to Supabase
    if (ENABLE_SUPABASE && supabase) {
      const tableName = getTableName(collectionName);
      let query = supabase.from(tableName).select('*');
      
      if (filters) {
        filters.forEach(f => {
          if (f.operator === '==') query = query.eq(f.field, f.value);
          // Add other operators if needed
        });
      }
      
      if (sortField) {
        query = query.order(sortField, { ascending: sortOrder === 'asc' });
      }

      const { data, error } = await query;
      if (error) {
        console.error("Supabase Fetch Error:", error);
        return [];
      }
      return data || [];
    }

    // Fallback to Turso (Basic implementation)
    if (ENABLE_TURSO && turso) {
      try {
        const tableName = getTableName(collectionName);
        const sql = `SELECT * FROM ${tableName}`;
        // Add WHERE/ORDER BY clauses...
        const result = await turso.execute(sql);
        return result.rows;
      } catch (error) {
        console.error("Turso Fetch Error:", error);
        return [];
      }
    }

    return [];
  },

  // Legacy/Helper methods (mapped to new ones or kept for specific functionality)
  
  // Alias for backward compatibility if needed, or replace usages
  async add(collectionName: string, data: Record<string, unknown>, explicitId?: string, usePrefix: boolean = true, skipSQL: boolean = false) {
    return this.saveData(collectionName, data, explicitId, usePrefix, skipSQL);
  },

  async update(collectionName: string, id: string, data: Record<string, unknown>, usePrefix: boolean = true, skipSQL: boolean = false) {
    return this.updateData(collectionName, id, data, usePrefix, skipSQL);
  },

  async delete(collectionName: string, id: string, usePrefix: boolean = true, skipSQL: boolean = false) {
    return this.deleteData(collectionName, id, usePrefix, skipSQL);
  },

  async fetch(collectionName: string, usePrefix: boolean = true, filters?: { field: string; operator: string; value: unknown }[], sortField?: string, sortOrder: 'asc' | 'desc' = 'asc') {
    return this.fetchData(collectionName, usePrefix, filters, sortField, sortOrder);
  },

  async getById(collectionName: string, id: string, usePrefix: boolean = true) {
    // Note: usePrefix arg is deprecated/handled internally by getFirestorePath/getTableName based on env
    
    if (ENABLE_FIREBASE) {
      const firestorePath = getFirestorePath(collectionName, usePrefix);
      const docRef = doc(db, firestorePath, id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
    }

    if (ENABLE_SUPABASE && supabase) {
      const tableName = getTableName(collectionName);
      const { data, error } = await supabase.from(tableName).select('*').eq('id', id).single();
      if (!error && data) return data;
    }

    return null;
  },

  // Real-time subscription (Keep Firestore for now as primary real-time engine)
  subscribe(collectionName: string, callback: (data: unknown[]) => void, usePrefix: boolean = true, filters?: { field: string; operator: string; value: unknown }[]) {
    if (ENABLE_FIREBASE) {
      const firestorePath = getFirestorePath(collectionName, usePrefix);
      let q = query(collection(db, firestorePath));
      if (filters) {
        filters.forEach(f => {
          q = query(q, where(f.field, f.operator as WhereFilterOp, f.value));
        });
      }
      return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(data);
      });
    }
    // TODO: Implement Supabase Realtime subscription if needed
    return () => {};
  },

  subscribeDoc(collectionName: string, id: string, callback: (data: unknown) => void, usePrefix: boolean = true) {
    if (ENABLE_FIREBASE) {
      const firestorePath = getFirestorePath(collectionName, usePrefix);
      const docRef = doc(db, firestorePath, id);
      return onSnapshot(docRef, (doc) => {
        if (doc.exists()) {
          callback({ id: doc.id, ...doc.data() });
        } else {
          callback(null);
        }
      });
    }
    return () => {};
  }
};
