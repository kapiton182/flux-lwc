import getContacts from '@salesforce/apex/StorageController.getContacts';

class Storage {
  subscribers = [];
  storage = {};
  cache = {};

  subscribe(cb) {
    this.subscribers.push(cb);
  }

  unsubscribe(cb) {
    this.subscribers = this.subscribers.filter((sub) => sub !== cb);
  }

  changeStorageData = (data) => {
    return { ...this.storage, ...data };
  };

  initComponent() {
    this._sendDataToSubs(this.storage);
  }

  _sendDataToSubs = (storage) => {
    this.subscribers.forEach((cb) => cb(storage));
    return storage;
  };

  _memoizeAsync(func) {
    return async (...args) => {
      const cacheKey = JSON.stringify(args);

      if (Object.keys(this.cache).includes(cacheKey) === false) {
        this.cache[cacheKey] = await func.apply(this, args);
        return this.cache[cacheKey];
      } else {
        return Promise.resolve(this.cache[cacheKey]);
      }
    };
  }

  _memoizeSync(func) {
    return (...args) => {
      const cacheKey = JSON.stringify(args);

      if (Object.keys(this.cache).includes(cacheKey) === false) {
        this.cache[cacheKey] = func.apply(this, args);
      }

      return this.cache[cacheKey];
    };
  }

  compose = (...fns) => (x) => fns.reduce((acc, fn) => acc.then(fn), Promise.resolve(x));
}

class TableStorage extends Storage {
  constructor() {
    super();
    this.storage.currentPage = 1;
    this.storage.pageSize = 20;
    this.storage.searchName = null;
    this._dispatchRequest = this._memoizeAsync(this._dispatchRequest);
    this.getRecordById = this._memoizeSync(this.getRecordById);

    this._makeRequestAndSendData = this.compose(this.changeStorageData, this._getParams, this._dispatchRequest, this._sendDataToSubs);
  }

  async changePage(payload) {
    this.storage = await this._makeRequestAndSendData(payload);
  }

  async initComponent() {
    this.storage = await this._makeRequestAndSendData(this.storage);
  }

  async searchFilms(payload) {
    this.storage = await this._makeRequestAndSendData(payload);
  }

  getRecordById(recordId) {
    return this.storage.cellsData.find((cellData) => cellData.Id === recordId);
  }

  async _dispatchRequest(params) {
    return getContacts({ params: params }).then((result) => {
      return {
        tableData: result,
        columnData: result.columnData,
        lastPage: Math.ceil(result.amountOfRecords / params.pageSize),
        cellsData: result.cellsData,
        currentPage: params.currentPage,
        pageSize: params.pageSize,
      };
    });
  }

  _getParams(storage) {
    return {
      pageSize: storage.pageSize,
      currentPage: storage.currentPage,
      searchName: storage.searchName,
    };
  }
}

class FilmCardStorage extends Storage {
  _changeStorageDataAndSendToSubs = this.compose(this.changeStorageData, this._sendDataToSubs);

  async changeStorageDataAndSendToSubs(payload) {
    this.storage = await this._changeStorageDataAndSendToSubs(payload);
  }
}

class PrefListStorage extends Storage {
  constructor() {
    super();
    this.storage.prefList = new Set();
    this._addRecordToPrefListAndSendDataToSubs = this.compose(this._addRecordToPrefList, this._sendDataToSubs);
    this._deleteRecordAndSendData = this.compose(this._deleteRecordFromPrefList, this.changeStorageData, this._sendDataToSubs);
  }

  _addRecordToPrefList = (data) => {
    this.storage.prefList.add(data);
    return this.storage;
  };

  async addRecordToPrefListAndSendDataToSubs(payload) {
    this.storage = await this._addRecordToPrefListAndSendDataToSubs(payload);
  }

  async deleteRecordFromList(payload) {
    this.storage = await this._deleteRecordAndSendData(payload);
  }

  _deleteRecordFromPrefList = (recordId) => {
    return { prefList: new Set([...this.storage.prefList].filter((record) => record.Id !== recordId)) };
  };
}

export const tableStorage = new TableStorage();
export const filmCardStorage = new FilmCardStorage();
export const prefListStorage = new PrefListStorage();
