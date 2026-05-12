// IndexedDB 存储工具
// 用于持久化存储截取的图片和拼接的图片

import { ExtractedFrame, MergedImage } from '../types';
import { handleError } from './errorHandler';

const DB_NAME = 'VideoSubtitleExtractor';
const DB_VERSION = 1;
const FRAMES_STORE = 'extractedFrames';
const MERGED_STORE = 'mergedImages';

class DBConnectionPool {
  private db: IDBDatabase | null = null;
  private openPromise: Promise<IDBDatabase> | null = null;

  async getConnection(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.openPromise) return this.openPromise;

    this.openPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        this.openPromise = null;
        reject(request.error);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(FRAMES_STORE)) {
          db.createObjectStore(FRAMES_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(MERGED_STORE)) {
          db.createObjectStore(MERGED_STORE, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.db.onversionchange = () => {
          this.close();
        };
        this.openPromise = null;
        resolve(this.db);
      };
    });

    return this.openPromise;
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.openPromise = null;
  }
}

const dbPool = new DBConnectionPool();

const runTransaction = async <T>(
  storeNames: string[],
  mode: IDBTransactionMode,
  operation: (tx: IDBTransaction) => IDBRequest<T> | void,
  fallbackValue?: T
): Promise<T> => {
  try {
    const db = await dbPool.getConnection();
    const transaction = db.transaction(storeNames, mode);
    const request = operation(transaction);

    return await new Promise<T>((resolve, reject) => {
      transaction.oncomplete = () => {
        if (request) resolve(request.result as T);
        else resolve(fallbackValue as T);
      };
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } catch (error) {
    throw error;
  }
};

// 保存截取的图片
export const saveExtractedFrames = async (frames: ExtractedFrame[]): Promise<void> => {
  try {
    await runTransaction<void>([FRAMES_STORE], 'readwrite', (transaction) => {
      const store = transaction.objectStore(FRAMES_STORE);
      store.clear();
      for (const frame of frames) {
        store.put(frame);
      }
    });
  } catch (error) {
    handleError(error, undefined, { context: 'Failed to save extracted frames' });
    throw error;
  }
};

// 加载截取的图片
export const loadExtractedFrames = async (): Promise<ExtractedFrame[]> => {
  try {
    const result = await runTransaction<ExtractedFrame[]>(
      [FRAMES_STORE],
      'readonly',
      (transaction) => transaction.objectStore(FRAMES_STORE).getAll(),
      []
    );
    return result || [];
  } catch (error) {
    handleError(error, undefined, { context: 'Failed to load extracted frames' });
    return [];
  }
};

// 保存拼接的图片
export const saveMergedImages = async (images: MergedImage[]): Promise<void> => {
  try {
    await runTransaction<void>([MERGED_STORE], 'readwrite', (transaction) => {
      const store = transaction.objectStore(MERGED_STORE);
      store.clear();
      for (const image of images) {
        store.put(image);
      }
    });
  } catch (error) {
    handleError(error, undefined, { context: 'Failed to save merged images' });
    throw error;
  }
};

// 加载拼接的图片
export const loadMergedImages = async (): Promise<MergedImage[]> => {
  try {
    const result = await runTransaction<MergedImage[]>(
      [MERGED_STORE],
      'readonly',
      (transaction) => transaction.objectStore(MERGED_STORE).getAll(),
      []
    );
    return result || [];
  } catch (error) {
    handleError(error, undefined, { context: 'Failed to load merged images' });
    return [];
  }
};

// 清空所有数据
export const clearAllData = async (): Promise<void> => {
  try {
    await runTransaction<void>([FRAMES_STORE, MERGED_STORE], 'readwrite', (transaction) => {
      transaction.objectStore(FRAMES_STORE).clear();
      transaction.objectStore(MERGED_STORE).clear();
    });
  } catch (error) {
    handleError(error, undefined, { context: 'Failed to clear data' });
    throw error;
  }
};

// 获取存储使用情况（估算）
export const getStorageInfo = async (): Promise<{ framesCount: number; mergedCount: number }> => {
  try {
    const db = await dbPool.getConnection();
    const transaction = db.transaction([FRAMES_STORE, MERGED_STORE], 'readonly');
    const framesRequest = transaction.objectStore(FRAMES_STORE).count();
    const mergedRequest = transaction.objectStore(MERGED_STORE).count();

    return await new Promise<{ framesCount: number; mergedCount: number }>((resolve, reject) => {
      transaction.oncomplete = () => {
        resolve({
          framesCount: framesRequest.result,
          mergedCount: mergedRequest.result,
        });
      };
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } catch (error) {
    handleError(error, undefined, { context: 'Failed to get storage info' });
    return { framesCount: 0, mergedCount: 0 };
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    dbPool.close();
  });
}
