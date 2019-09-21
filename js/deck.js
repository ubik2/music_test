import { Card } from "./card";
import { Logger, Random, DateUtil } from "./utils";
import { BaseScheduler } from "./base_scheduler";
import { AnkiScheduler } from "./anki_scheduler";

export class Deck {
    /**
     * Create a new Deck
     * @param {String} deckId the id of the deck
     * @param {Array.<Card>} cards cards to include in deck (or null)
     * @param {Logger} logger the Logger used to log message or null for the default implementation
     * @param {Random} random the Random object used to generate random values or null for the default implementation
     * @param {DateUtil} dateUtil the DateUtil object used to fetch the current time or null for the default implementation
     */
    constructor(deckId, cards, logger = null, random = null, dateUtil = null) {
        this.deckId = deckId;
        this.cards = cards || [];
        this.logger = logger || new Logger();
        this.random = random || new Random();
        this.dateUtil = dateUtil || new DateUtil();
        this.creation = BaseScheduler.intNow(this.dateUtil); // seconds since epoch when deck was created
        this.scheduler = new AnkiScheduler(this);
    }

    addCard(card) {
        this.cards.push(card);
        return this;
    }

    removeCard(card) {
        const index = this.cards.indexOf(card);
        if (index > -1) {
            this.cards.splice(index, 1);
        }
        return this;
    }

    shuffleDeck() {
        this.cards = this.shuffledCards(this.cards);
    }

    static stableSort(arr, cmp) {
        let arrIndexed = arr.map((el, index) => [el, index]);
        return arrIndexed.sort((a, b) => {
            let rv = cmp(a[0], b[0]);
            if (rv !== 0) return rv;
            return a[1] - b[1];
        }).map((el, index) => el[0]);
    }

    shuffledCards(cards) {
        const shuffledCards = cards.slice(0, cards.length);
        for (let shuffleIndex = 0; shuffleIndex < shuffledCards.length; shuffleIndex++) {
            const randomIndex = shuffleIndex + Math.floor(this.random.random() * (shuffledCards.length - shuffleIndex));
            const tmpCard = shuffledCards[shuffleIndex];
            shuffledCards[shuffleIndex] = shuffledCards[randomIndex];
            shuffledCards[randomIndex] = tmpCard;
        }
        return shuffledCards;
    }
}