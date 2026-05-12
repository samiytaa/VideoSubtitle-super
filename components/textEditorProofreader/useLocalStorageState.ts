import { Dispatch, SetStateAction, useEffect, useState } from 'react';

interface LocalStorageStateOptions<T> {
  serialize?: (value: T) => string;
  deserialize?: (raw: string) => T;
}

export function useLocalStorageState<T>(
  key: string,
  initialValue: T,
  options: LocalStorageStateOptions<T> = {}
): [T, Dispatch<SetStateAction<T>>, { clear: () => void }] {
  const { serialize = JSON.stringify, deserialize = JSON.parse } = options;

  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved === null) return initialValue;
      return deserialize(saved);
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, serialize(value));
    } catch {
      // ignore persistence errors
    }
  }, [key, value, serialize]);

  const clear = () => {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore persistence errors
    }
    setValue(initialValue);
  };

  return [value, setValue, { clear }];
}
