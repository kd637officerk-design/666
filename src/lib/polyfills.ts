// Runtime polyfills for older Android System WebViews (Chrome 87 - 144)
// Loaded before App / pdfjs-dist so ES2022-ES2026 helpers never crash on launch.

(() => {
  const g = typeof globalThis !== 'undefined' ? (globalThis as Record<string, unknown>) : undefined;
  if (!g) return;

  if (typeof Promise.withResolvers !== 'function') {
    Object.defineProperty(Promise, 'withResolvers', {
      configurable: true,
      writable: true,
      value: function withResolvers<T>() {
        let resolve!: (value: T | PromiseLike<T>) => void;
        let reject!: (reason?: unknown) => void;
        const promise = new Promise<T>((res, rej) => {
          resolve = res;
          reject = rej;
        });
        return { promise, resolve, reject };
      },
    });
  }

  const PromiseWithTry = Promise as unknown as {
    try?: <T, A extends unknown[]>(fn: (...args: A) => T | PromiseLike<T>, ...args: A) => Promise<T>;
  };
  if (typeof PromiseWithTry.try !== 'function') {
    Object.defineProperty(Promise, 'try', {
      configurable: true,
      writable: true,
      value: function promiseTry<T, A extends unknown[]>(
        fn: (...args: A) => T | PromiseLike<T>,
        ...args: A
      ): Promise<T> {
        return new Promise<T>((resolve) => {
          resolve(fn(...args));
        });
      },
    });
  }

  if (typeof Object.hasOwn !== 'function') {
    Object.defineProperty(Object, 'hasOwn', {
      configurable: true,
      writable: true,
      value: (obj: object, prop: PropertyKey) =>
        Object.prototype.hasOwnProperty.call(obj, prop),
    });
  }

  const URLCtor = typeof URL !== 'undefined' ? (URL as unknown as {
    parse?: (url: string, base?: string | URL) => URL | null;
    canParse?: (url: string, base?: string | URL) => boolean;
  }) : undefined;

  if (URLCtor && typeof URLCtor.parse !== 'function') {
    Object.defineProperty(URL, 'parse', {
      configurable: true,
      writable: true,
      value: (url: string, base?: string | URL): URL | null => {
        try {
          return base !== undefined ? new URL(url, base) : new URL(url);
        } catch {
          return null;
        }
      },
    });
  }

  if (URLCtor && typeof URLCtor.canParse !== 'function') {
    Object.defineProperty(URL, 'canParse', {
      configurable: true,
      writable: true,
      value: (url: string, base?: string | URL): boolean => {
        try {
          if (base !== undefined) {
            new URL(url, base);
          } else {
            new URL(url);
          }
          return true;
        } catch {
          return false;
        }
      },
    });
  }

  const mapProto = Map.prototype as unknown as {
    getOrInsert?: <K, V>(this: Map<K, V>, key: K, defaultValue: V) => V;
    getOrInsertComputed?: <K, V>(this: Map<K, V>, key: K, cb: (key: K) => V) => V;
  };
  if (typeof mapProto.getOrInsert !== 'function') {
    Object.defineProperty(Map.prototype, 'getOrInsert', {
      configurable: true,
      writable: true,
      value: function <K, V>(this: Map<K, V>, key: K, defaultValue: V): V {
        if (!this.has(key)) this.set(key, defaultValue);
        return this.get(key) as V;
      },
    });
  }
  if (typeof mapProto.getOrInsertComputed !== 'function') {
    Object.defineProperty(Map.prototype, 'getOrInsertComputed', {
      configurable: true,
      writable: true,
      value: function <K, V>(this: Map<K, V>, key: K, cb: (key: K) => V): V {
        if (!this.has(key)) {
          const val = cb(key);
          this.set(key, val);
          return val;
        }
        return this.get(key) as V;
      },
    });
  }

  const weakMapProto = WeakMap.prototype as unknown as {
    getOrInsert?: <K extends object, V>(this: WeakMap<K, V>, key: K, defaultValue: V) => V;
    getOrInsertComputed?: <K extends object, V>(this: WeakMap<K, V>, key: K, cb: (key: K) => V) => V;
  };
  if (typeof weakMapProto.getOrInsert !== 'function') {
    Object.defineProperty(WeakMap.prototype, 'getOrInsert', {
      configurable: true,
      writable: true,
      value: function <K extends object, V>(this: WeakMap<K, V>, key: K, defaultValue: V): V {
        if (!this.has(key)) this.set(key, defaultValue);
        return this.get(key) as V;
      },
    });
  }
  if (typeof weakMapProto.getOrInsertComputed !== 'function') {
    Object.defineProperty(WeakMap.prototype, 'getOrInsertComputed', {
      configurable: true,
      writable: true,
      value: function <K extends object, V>(this: WeakMap<K, V>, key: K, cb: (key: K) => V): V {
        if (!this.has(key)) {
          const val = cb(key);
          this.set(key, val);
          return val;
        }
        return this.get(key) as V;
      },
    });
  }

  const arrProto = Array.prototype as unknown as {
    at?: <T>(this: T[], index: number) => T | undefined;
    toReversed?: <T>(this: T[]) => T[];
    toSorted?: <T>(this: T[], compareFn?: (a: T, b: T) => number) => T[];
    toSpliced?: <T>(this: T[], start: number, deleteCount?: number, ...items: T[]) => T[];
  };
  if (typeof arrProto.at !== 'function') {
    Object.defineProperty(Array.prototype, 'at', {
      configurable: true,
      writable: true,
      value: function <T>(this: T[], n: number): T | undefined {
        const idx = n < 0 ? this.length + n : n;
        if (idx < 0 || idx >= this.length) return undefined;
        return this[idx];
      },
    });
  }
  if (typeof arrProto.toReversed !== 'function') {
    Object.defineProperty(Array.prototype, 'toReversed', {
      configurable: true,
      writable: true,
      value: function <T>(this: T[]): T[] {
        return [...this].reverse();
      },
    });
  }
  if (typeof arrProto.toSorted !== 'function') {
    Object.defineProperty(Array.prototype, 'toSorted', {
      configurable: true,
      writable: true,
      value: function <T>(this: T[], compareFn?: (a: T, b: T) => number): T[] {
        return [...this].sort(compareFn);
      },
    });
  }
  if (typeof arrProto.toSpliced !== 'function') {
    Object.defineProperty(Array.prototype, 'toSpliced', {
      configurable: true,
      writable: true,
      value: function <T>(this: T[], start: number, deleteCount?: number, ...items: T[]): T[] {
        const copy = [...this];
        if (deleteCount === undefined) copy.splice(start);
        else copy.splice(start, deleteCount, ...items);
        return copy;
      },
    });
  }

  const u8Ctor = Uint8Array as unknown as {
    fromBase64?: (b64: string) => Uint8Array;
  };
  if (typeof u8Ctor.fromBase64 !== 'function') {
    Object.defineProperty(Uint8Array, 'fromBase64', {
      configurable: true,
      writable: true,
      value: (b64: string): Uint8Array => {
        const clean = b64.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
        const bin = atob(clean);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i += 1) {
          bytes[i] = bin.charCodeAt(i);
        }
        return bytes;
      },
    });
  }

  const u8Proto = Uint8Array.prototype as unknown as {
    toBase64?: (this: Uint8Array) => string;
  };
  if (typeof u8Proto.toBase64 !== 'function') {
    Object.defineProperty(Uint8Array.prototype, 'toBase64', {
      configurable: true,
      writable: true,
      value: function (this: Uint8Array): string {
        let bin = '';
        for (let i = 0; i < this.length; i += 1) {
          bin += String.fromCharCode(this[i]);
        }
        return btoa(bin);
      },
    });
  }

  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID !== 'function') {
    Object.defineProperty(crypto, 'randomUUID', {
      configurable: true,
      writable: true,
      value: (): `${string}-${string}-${string}-${string}-${string}` => {
        const bytes = new Uint8Array(16);
        if (typeof crypto.getRandomValues === 'function') {
          crypto.getRandomValues(bytes);
        } else {
          for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
        }
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` as `${string}-${string}-${string}-${string}-${string}`;
      },
    });
  }

  if (typeof g.structuredClone !== 'function') {
    g.structuredClone = <T>(val: T): T => JSON.parse(JSON.stringify(val)) as T;
  }
})();

export {};
