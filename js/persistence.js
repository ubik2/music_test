import { Card, Queue, CardType } from "./card";
import { Logger, Random, DateUtil } from "./utils";
import { MusicCard } from "./musiccard";
import { Deck } from "./deck";

const TransactionType = {
    READONLY: "readonly",
    READWRITE: "readwrite"
};

const PersistenceConstants = {
    DATABASE_NAME: "MusicTestDatabase",
    DATABASE_VERSION: 1,
    DECK_TABLE: "decks"
};

export class Persistence {
    constructor(logger = null, random = null, dateUtil = null) {
        this.logger = logger || new Logger();
        this.random = random || new Random();
        this.dateUtil = dateUtil || new DateUtil();

        this.db = null;
        this.pendingReadyCallbacks = [];

        const request = window.indexedDB.open(PersistenceConstants.DATABASE_NAME, PersistenceConstants.DATABASE_VERSION);
        request.onerror = (event) => {
            this.logger.error("Failed to do something with db request. request.errorCode: ", request.errorCode);
            throw "Failed to handle db request";
        };
        request.onsuccess = (event) => {
            this.logger.log("Successfully did something with db request.");
            this.db = event.target.result;

            this.triggerPendingReadyCallbacks();

            this.db.onerror = (event) => {
                this.logger.error("Database error: " + event.target.errorCode);
            };
        };
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            const objectStore = db.createObjectStore(PersistenceConstants.DECK_TABLE, { keyPath: "deckId" });

            //objectStore.transaction.oncomplete = (event) => {
            //    var deckObjectStore = db.transaction(PersistenceConstants.DECK_TABLE, TransactionType.READWRITE).objectStore(PersistenceConstants.DECK_TABLE);
            //    deckData.forEach((deck) => {
            //        deckObjectStore.add(deck);
            //    });
            //};
        };
    }

    triggerPendingReadyCallbacks() {
        this.pendingReadyCallbacks.forEach((callback) => callback());
        this.pendingReadyCallbacks = [];
    }

    whenReady(callback) {
        this.pendingReadyCallbacks.push(callback);
        if (this.db !== null) {
            this.triggerPendingReadyCallbacks();
        }
    }

    saveDeck(deck, saveCallback = null) {
        const simpleDeck = this.uninjectedDeck(deck);
        const transaction = this.db.transaction([PersistenceConstants.DECK_TABLE], TransactionType.READWRITE);
        transaction.oncomplete = (event) => {
            this.logger.log("All done!");
        };

        transaction.onerror = (event) => {
            this.logger.error("Failed to save deck: ", event);
            throw "Failed to save deck";
        };

        const objectStore = transaction.objectStore(PersistenceConstants.DECK_TABLE);
        const request = objectStore.put(simpleDeck);
        request.onerror = (event) => {
            if (saveCallback !== null) {
                saveCallback(false, simpleDeck);
            }
        };
        request.onsuccess = (event) => {
            event.target.result === simpleDeck.deckId;
            if (saveCallback !== null) {
                saveCallback(true, deck);
            }
        };
    }

    loadDeck(deckId, loadCallback = null) {
        const transaction = this.db.transaction([PersistenceConstants.DECK_TABLE]);
        const objectStore = transaction.objectStore(PersistenceConstants.DECK_TABLE);
        const request = objectStore.get(deckId);
        request.onerror = (event) => {
            if (loadCallback !== null) {
                loadCallback(false, null);
            }
        };
        request.onsuccess = (event) => {
            this.logger.debug("Loaded deck: ", request.result);
            if (loadCallback !== null) {
                loadCallback(true, this.injectedDeck(request.result));
            }
        };
    }

    uninjectedDeck(injectedDeck) {
        if (injectedDeck === undefined) {
            return undefined;
        }
        const deck = Object.assign({}, injectedDeck);
        // These are temporal attributes that should not be persisted
        delete deck.dayCutoff;
        delete deck.today;
        // These are injected attributes that should not be persisted
        delete deck.logger;
        delete deck.dateUtil;
        delete deck.random;
        return deck;
    }

    injectedDeck(uninjectedDeck) {
        if (uninjectedDeck === undefined) {
            return undefined;
        }
        const deck = new Deck(undefined, undefined);
        const rv = Object.assign(deck, uninjectedDeck, { logger: this.logger, random: this.random, dateUtil: this.dateUtil });
        rv.dayCutoff = deck.dayCutoffInternal();
        rv.today = deck.daysSinceCreation();
        return rv;
    }
}
