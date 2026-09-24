const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const { get, head, put } = require("@vercel/blob");

const isVercel = Boolean(process.env.VERCEL);
const hasBlobCredentials = Boolean(
  process.env.BLOB_READ_WRITE_TOKEN
    || process.env.BLOB_STORE_ID
    || process.env.VERCEL_OIDC_TOKEN,
);
const useBlobStorage = hasBlobCredentials;
const DB_FILE_PATH = path.join(__dirname, "../../data/db.json");
const DB_BLOB_PATH = process.env.DB_BLOB_PATH || "housing-society/data/db.json";

/**
 * File-based database manager
 * Acts as a temporary database using JSON file storage
 * All operations are async to simulate real database behavior
 */
class FileDB {
  constructor() {
    this.data = null;
    this.initialized = false;
    this.savePromise = Promise.resolve();
    this.blobEtag = null;
    this.storagePath = useBlobStorage ? DB_BLOB_PATH : DB_FILE_PATH;
    this.storageMode = useBlobStorage ? "private-vercel-blob" : "local-json-file";
  }

  createEmptyData() {
    return {
      users: [],
      roles: [],
    };
  }

  async readBlob() {
    const result = await get(DB_BLOB_PATH, {
      access: "private",
      useCache: false,
    });
    if (!result) return null;
    const content = await new Response(result.stream).text();
    return {
      data: JSON.parse(content),
      etag: result.blob.etag,
    };
  }

  /**
   * Refresh the in-memory copy from persistent storage. This is called before
   * each Vercel request so warm and cold function instances read the same file.
   */
  async refresh() {
    if (!this.initialized) return this.init();
    if (!useBlobStorage) return this.data;
    const current = await this.readBlob();
    if (!current) throw new Error(`Persistent database blob not found: ${DB_BLOB_PATH}`);
    this.data = current.data;
    this.blobEtag = current.etag;
    return this.data;
  }

  /**
   * Initialize the JSON database from local disk or private Vercel Blob.
   */
  async init() {
    if (this.initialized) return;
    try {
      if (isVercel && !useBlobStorage) {
        throw new Error("Vercel requires a connected private Blob store. Set BLOB_READ_WRITE_TOKEN or connect Blob with OIDC.");
      }

      if (useBlobStorage) {
        const current = await this.readBlob();
        if (current) {
          this.data = current.data;
          this.blobEtag = current.etag;
        } else {
          this.data = this.createEmptyData();
          this.initialized = true;
          await this.save();
        }
      } else {
        const dataDir = path.dirname(DB_FILE_PATH);
        await fs.mkdir(dataDir, { recursive: true });
        try {
          this.data = JSON.parse(await fs.readFile(DB_FILE_PATH, "utf-8"));
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
          this.data = this.createEmptyData();
          await this.save();
        }
      }

      this.initialized = true;
      console.log(`✅ File-based database initialized (${this.storageMode})`);
    } catch (error) {
      console.error("❌ Failed to initialize file database:", error.message);
      throw error;
    }
  }

  /**
   * Persist current state to local disk or private Vercel Blob.
   */
  async save() {
    this.savePromise = this.savePromise
      .catch(() => undefined)
      .then(async () => {
        try {
          const payload = JSON.stringify(this.data, null, 2);
          if (useBlobStorage) {
            const options = {
              access: "private",
              addRandomSuffix: false,
              allowOverwrite: true,
              contentType: "application/json",
              cacheControlMaxAge: 0,
            };
            await put(DB_BLOB_PATH, payload, options);
            this.blobEtag = (await head(DB_BLOB_PATH)).etag;
          } else {
            await fs.writeFile(DB_FILE_PATH, payload, "utf-8");
          }
        } catch (error) {
          console.error("❌ Failed to save database:", error.message);
          throw error;
        }
      });
    return this.savePromise;
  }

  /**
   * Generate a unique ID (simulates database auto-generated IDs)
   */
  generateId() {
    return crypto.randomBytes(12).toString("hex");
  }

  /**
   * Get collection
   */
  collection(name) {
    if (!this.initialized) {
      throw new Error("Database not initialized. Call init() first.");
    }

    if (!this.data[name]) {
      this.data[name] = [];
    }

    return {
      // Find one document
      findOne: async (query) => {
        const result = this.data[name].find((doc) => this._matchQuery(doc, query));
        return result ? JSON.parse(JSON.stringify(result)) : null;
      },

      // Find one document and update it atomically
      findOneAndUpdate: async (query, update, options = {}) => {
        const index = this.data[name].findIndex((doc) => this._matchQuery(doc, query));
        if (index === -1) return null;

        const updateData = update.$set || update;
        this.data[name][index] = {
          ...this.data[name][index],
          ...updateData,
          updatedAt: new Date().toISOString(),
        };
        await this.save();

        const document = JSON.parse(JSON.stringify(this.data[name][index]));
        return options.returnDocument === "before"
          ? JSON.parse(JSON.stringify(this.data[name][index]))
          : document;
      },

      // Find multiple documents
      find: async (query = {}, options = {}) => {
        let results = this.data[name].filter((doc) => this._matchQuery(doc, query));

        // Apply sorting
        if (options.sort) {
          const [[field, order]] = Object.entries(options.sort);
          results.sort((a, b) => {
            const aVal = this._getNestedValue(a, field);
            const bVal = this._getNestedValue(b, field);
            return order === 1 ? (aVal > bVal ? 1 : -1) : aVal < bVal ? 1 : -1;
          });
        }

        // Apply limit
        if (options.limit) {
          results = results.slice(0, options.limit);
        }

        // Apply skip
        if (options.skip) {
          results = results.slice(options.skip);
        }

        // Apply select (projection)
        if (options.select) {
          results = results.map((doc) => {
            const projected = {};
            Object.keys(options.select).forEach((field) => {
              if (options.select[field]) {
                projected[field] = this._getNestedValue(doc, field);
              }
            });
            return { ...projected, _id: doc._id };
          });
        }

        return JSON.parse(JSON.stringify(results));
      },

      // Mongo-compatible subset used by reporting services while file storage is active
      aggregate: async (pipeline = []) => {
        let results = [...this.data[name]];
        for (const stage of pipeline) {
          if (stage.$match) results = results.filter((doc) => this._matchQuery(doc, stage.$match));
          if (stage.$group) {
            const groups = new Map();
            for (const doc of results) {
              const key = JSON.stringify(this._evaluateExpression(doc, stage.$group._id));
              if (!groups.has(key)) groups.set(key, { _id: this._evaluateExpression(doc, stage.$group._id) });
              const group = groups.get(key);
              for (const [field, accumulator] of Object.entries(stage.$group)) {
                if (field === "_id") continue;
                if (accumulator.$sum !== undefined) group[field] = (group[field] || 0) + (accumulator.$sum === 1 ? 1 : Number(this._evaluateExpression(doc, accumulator.$sum) || 0));
                if (accumulator.$count) group[field] = (group[field] || 0) + 1;
              }
            }
            results = Array.from(groups.values());
          }
          if (stage.$sort) {
            const [[field, order]] = Object.entries(stage.$sort);
            results.sort((a, b) => order === 1 ? (a[field] > b[field] ? 1 : -1) : (a[field] < b[field] ? 1 : -1));
          }
          if (stage.$project) results = results.map((doc) => Object.fromEntries(Object.entries(stage.$project).filter(([, include]) => include).map(([field]) => [field, this._getNestedValue(doc, field)])));
        }
        return JSON.parse(JSON.stringify(results));
      },

      // Count documents
      countDocuments: async (query = {}) => {
        return this.data[name].filter((doc) => this._matchQuery(doc, query)).length;
      },

      // Backward-compatible alias used by older modules
      count: async (query = {}) => {
        return this.data[name].filter((doc) => this._matchQuery(doc, query)).length;
      },

      // Insert one document
      insertOne: async (document) => {
        const newDoc = {
          _id: this.generateId(),
          ...document,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.data[name].push(newDoc);
        await this.save();
        return { insertedId: newDoc._id, ...newDoc };
      },

      // Insert many documents
      insertMany: async (documents) => {
        const newDocs = documents.map((doc) => ({
          _id: this.generateId(),
          ...doc,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
        this.data[name].push(...newDocs);
        await this.save();
        return newDocs;
      },

      // Update one document
      updateOne: async (query, update) => {
        const index = this.data[name].findIndex((doc) => this._matchQuery(doc, query));
        if (index === -1) {
          return { matchedCount: 0, modifiedCount: 0 };
        }

        const updateData = update.$set || update;
        this.data[name][index] = {
          ...this.data[name][index],
          ...updateData,
          updatedAt: new Date().toISOString(),
        };
        await this.save();
        return { matchedCount: 1, modifiedCount: 1 };
      },

      // Update many documents
      updateMany: async (query, update) => {
        const updateData = update.$set || update;
        let modifiedCount = 0;

        this.data[name] = this.data[name].map((doc) => {
          if (this._matchQuery(doc, query)) {
            modifiedCount++;
            return {
              ...doc,
              ...updateData,
              updatedAt: new Date().toISOString(),
            };
          }
          return doc;
        });

        await this.save();
        return { matchedCount: modifiedCount, modifiedCount };
      },

      // Delete one document
      deleteOne: async (query) => {
        const index = this.data[name].findIndex((doc) => this._matchQuery(doc, query));
        if (index === -1) {
          return { deletedCount: 0 };
        }

        this.data[name].splice(index, 1);
        await this.save();
        return { deletedCount: 1 };
      },

      // Delete many documents
      deleteMany: async (query) => {
        const initialLength = this.data[name].length;
        this.data[name] = this.data[name].filter((doc) => !this._matchQuery(doc, query));
        const deletedCount = initialLength - this.data[name].length;
        await this.save();
        return { deletedCount };
      },
    };
  }

  /**
   * Match a document against a query
   */
  _matchQuery(doc, query) {
    return Object.entries(query).every(([key, value]) => {
      const docValue = this._getNestedValue(doc, key);

      // Handle special operators
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        // $in operator
        if (value.$in && Array.isArray(value.$in) && !value.$in.includes(docValue)) return false;
        // $ne operator
        if (value.$ne !== undefined && docValue === value.$ne) return false;
        // $gt, $gte, $lt, $lte operators
        if (value.$gt !== undefined && !(docValue > value.$gt)) return false;
        if (value.$gte !== undefined && !(docValue >= value.$gte)) return false;
        if (value.$lt !== undefined && !(docValue < value.$lt)) return false;
        if (value.$lte !== undefined && !(docValue <= value.$lte)) return false;
        return true;
      }

      // Simple equality
      return docValue === value;
    });
  }

  /**
   * Get nested value from object using dot notation
   */
  _getNestedValue(obj, path) {
    return path.split(".").reduce((current, prop) => current?.[prop], obj);
  }

  _evaluateExpression(doc, expression) {
    if (typeof expression === "string" && expression.startsWith("$")) return this._getNestedValue(doc, expression.slice(1));
    if (expression && expression.$dateToString) {
      const date = new Date(this._evaluateExpression(doc, expression.$dateToString.date));
      const format = expression.$dateToString.format;
      if (format === "%Y-%m") return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      if (format === "%Y-%m-%d") return date.toISOString().slice(0, 10);
      return date.toISOString();
    }
    return expression;
  }

  /**
   * Start a session (for transaction simulation - no-op for file DB)
   */
  async startSession() {
    return {
      startTransaction: () => {},
      commitTransaction: async () => {},
      abortTransaction: async () => {},
      endSession: async () => {},
    };
  }

  /**
   * Populate references (simulates Mongoose populate)
   */
  async populate(doc, populateOptions) {
    if (!doc) return doc;

    const populateField = typeof populateOptions === "string" ? populateOptions : populateOptions.path;
    const fromCollection = populateOptions.from || populateField + "s"; // Simple convention

    if (Array.isArray(doc[populateField])) {
      // Populate array of references
      doc[populateField] = await Promise.all(
        doc[populateField].map(async (id) => {
          const refDoc = await this.collection(fromCollection).findOne({ _id: id });
          return refDoc || id;
        })
      );
    } else if (doc[populateField]) {
      // Populate single reference
      const refDoc = await this.collection(fromCollection).findOne({ _id: doc[populateField] });
      doc[populateField] = refDoc || doc[populateField];
    }

    return doc;
  }
}

// Singleton instance
const fileDB = new FileDB();

module.exports = fileDB;
