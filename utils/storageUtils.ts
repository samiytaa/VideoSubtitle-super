// IndexedDB 存储工具
// 用于持久化存储截取的图片和拼接的图片

const DB_NAME = 'VideoSubtitleExtractor';
const DB_VERSION = 1;
const FRAMES_STORE = 'extractedFrames';
const MERGED_STORE = 'mergedImages';

// 打开数据库
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 创建存储对象
      if (!db.objectStoreNames.contains(FRAMES_STORE)) {
        db.createObjectStore(FRAMES_STORE, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(MERGED_STORE)) {
        db.createObjectStore(MERGED_STORE, { keyPath: 'id' });
      }
    };
  });
};

// 保存截取的图片
export const saveExtractedFrames = async (frames: any[]): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([FRAMES_STORE], 'readwrite');
    const store = transaction.objectStore(FRAMES_STORE);

    // 清空旧数据
    store.clear();

    // 保存新数据
    for (const frame of frames) {
      store.put(frame);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error('Failed to save extracted frames:', error);
    throw error;
  }
};

// 加载截取的图片
export const loadExtractedFrames = async (): Promise<any[]> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([FRAMES_STORE], 'readonly');
    const store = transaction.objectStore(FRAMES_STORE);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        db.close();
        resolve(request.result || []);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Failed to load extracted frames:', error);
    return [];
  }
};

// 保存拼接的图片
export const saveMergedImages = async (images: any[]): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([MERGED_STORE], 'readwrite');
    const store = transaction.objectStore(MERGED_STORE);

    // 清空旧数据
    store.clear();

    // 保存新数据
    for (const image of images) {
      store.put(image);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error('Failed to save merged images:', error);
    throw error;
  }
};

// 加载拼接的图片
export const loadMergedImages = async (): Promise<any[]> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([MERGED_STORE], 'readonly');
    const store = transaction.objectStore(MERGED_STORE);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        db.close();
        resolve(request.result || []);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Failed to load merged images:', error);
    return [];
  }
};

// 清空所有数据
export const clearAllData = async (): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([FRAMES_STORE, MERGED_STORE], 'readwrite');
    
    transaction.objectStore(FRAMES_STORE).clear();
    transaction.objectStore(MERGED_STORE).clear();

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error('Failed to clear data:', error);
    throw error;
  }
};

// 获取存储使用情况（估算）
export const getStorageInfo = async (): Promise<{ framesCount: number; mergedCount: number }> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([FRAMES_STORE, MERGED_STORE], 'readonly');
    
    const framesRequest = transaction.objectStore(FRAMES_STORE).count();
    const mergedRequest = transaction.objectStore(MERGED_STORE).count();

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        db.close();
        resolve({
          framesCount: framesRequest.result,
          mergedCount: mergedRequest.result
        });
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error('Failed to get storage info:', error);
    return { framesCount: 0, mergedCount: 0 };
  }
};
