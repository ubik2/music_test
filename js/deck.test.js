import { Deck } from "./deck";
import { Logger, DummyLogger, TestRandom, TestDateUtil } from "./utils";
import { MusicCard } from "./musiccard";
import { CardType, Queue } from "./card";
import { Grade, BaseScheduler } from "./base_scheduler";
import { AnkiScheduler } from "./anki_scheduler";
import { SuperMemoScheduler } from "./supermemo_scheduler";

let testLogger = new DummyLogger();
let testRandom = new TestRandom();
let testDateUtil = new TestDateUtil();
const startingDateMillis = 1563425466519;
testDateUtil.setNow(startingDateMillis);

function generateTestDeck() {
    const keys = ['C/4', 'D/4', 'E/4', 'F/4', 'G/4', 'A/4', 'B/4'];
    const cards = [];
    for (let i = 0; i < 7; i++) {
        for (let j = 0; j < 7; j++) {
            if (j === i) {
                continue;
            }
            //cards.push(new Card());
            cards.push(new MusicCard('C', keys[i], keys[j]));
        }
    }
    return new Deck("C", cards, undefined, testLogger, testRandom, testDateUtil);
}

function generateTestDeckAnki() {
    const deck = generateTestDeck();
    deck.scheduler = new AnkiScheduler(deck, deck.logger, deck.random, deck.dateUtil);
    return deck;
}

function generateTestDeckSM2() {
    const deck = generateTestDeck();
    deck.scheduler = new SuperMemoScheduler(deck, deck.logger, deck.random, deck.dateUtil);
    return deck;
}

test('Checks that new deck has 42 cards', () => {
    const deck = generateTestDeckAnki();
    expect(deck.cards.length).toBe(42);
});

test('Null shuffle', () => {
    const deck = generateTestDeckAnki();
    const currentCards = deck.cards.slice(0, deck.cards.length);
    testRandom.appendRandom(Array(deck.cards.length).fill(0));
    const shuffledCards = deck.shuffledCards(deck.cards);
    expect(currentCards.length).toBe(deck.cards.length);
    expect(shuffledCards.length).toBe(deck.cards.length);
    for (let i = 0; i < currentCards.length; i++) {
        expect(currentCards[i].id).toBe(shuffledCards[i].id);
    }
});

function answerNewCardsAnki(deck, ease) {
    const newPerDay = deck.scheduler.deckNewLimit;
    expect(newPerDay).toBe(4); // deck new limit should be 4
    for (let i = 0; i < newPerDay; i++) {
        const card = deck.scheduler.getCard();
        expect(card).not.toBeNull();
        expect(card.queue).toBe(Queue.NEW);
        expect(card.cardType).toBe(CardType.NEW);
        // we will move the card to the learn queue, and reschedule it; supply the random we need to randomize the due date
        testRandom.appendRandom([0]);
        deck.scheduler.answerCard(card, ease);
        if (ease === Grade.GREAT) {
            expect(card.queue).toBe(Queue.REVIEW);
            expect(card.cardType).toBe(CardType.REVIEW);
        } else if (ease === Grade.GOOD || ease === Grade.PASS) {
            expect(card.queue).toBe(Queue.LEARN);
            expect(card.cardType).toBe(CardType.LEARN);
        } else if (ease <= Grade.FAIL) {
            expect(card.queue).toBe(Queue.LEARN);
            expect(card.cardType).toBe(CardType.LEARN);
        }
    }
}

function answerLearnCardsAnki(deck, ease, expectReview = true) {
    const newPerDay = deck.scheduler.deckNewLimit;
    // we should have all those cards in the learn queue now
    expect(deck.scheduler.learnQueue.length).toBe(newPerDay);
    // we will shuffle the learnQueue, so provide enough randomness for that (this will not change the order)
    testRandom.appendRandom(Array(deck.scheduler.learnQueue.length).fill(0));
    for (let i = 0; i < newPerDay; i++) {
        const card = deck.scheduler.getCard();
        expect(card).not.toBeNull();
        expect(card.queue).toBe(Queue.LEARN);
        expect(card.cardType).toBe(CardType.LEARN);
        deck.scheduler.answerCard(card, ease);
        if (ease === Grade.GOOD || ease === Grade.GREAT) {
            if (expectReview) {
                expect(card.queue).toBe(Queue.REVIEW);
                expect(card.cardType).toBe(CardType.REVIEW);
            } else {
                expect(card.queue).toBe(Queue.LEARN);
                expect(card.cardType).toBe(CardType.LEARN);
            }
        } else if (ease === Grade.PASS || ease <= Grade.FAIL) {
            expect(card.queue).toBe(Queue.LEARN);
            expect(card.cardType).toBe(CardType.LEARN);
        }
    }
}

function answerNewCardsSM2(deck, ease) {
    const newPerDay = deck.scheduler.deckNewLimit;
    expect(newPerDay).toBe(4); // deck new limit should be 4
    for (let i = 0; i < newPerDay; i++) {
        const card = deck.scheduler.getCard();
        expect(card).not.toBeNull();
        expect(card.queue).toBe(Queue.NEW);
        expect(card.cardType).toBe(CardType.NEW);
        // we will move the card to the learn queue, and reschedule it
        deck.scheduler.answerCard(card, ease);
        if (ease >= Grade.PASS) {
            expect(card.queue).toBe(Queue.REVIEW);
            expect(card.cardType).toBe(CardType.REVIEW);
        } else if (ease <= Grade.FAIL) {
            expect(card.queue).toBe(Queue.LEARN);
            expect(card.cardType).toBe(CardType.LEARN);
        }
    }
}

function answerLearnCardsSM2(deck, ease) {
    const newPerDay = deck.scheduler.deckNewLimit;
    // we should have all those cards in the learn queue now
    //expect(deck.scheduler.learnQueue.length).toBe(newPerDay);
    for (let i = 0; i < newPerDay; i++) {
        const card = deck.scheduler.getCard();
        expect(card).not.toBeNull();
        expect(card.queue).toBe(Queue.LEARN);
        expect(card.cardType).toBe(CardType.LEARN);
        deck.scheduler.answerCard(card, ease);
        if (ease >= Grade.PASS) {
            expect(card.queue).toBe(Queue.REVIEW);
            expect(card.cardType).toBe(CardType.REVIEW);
        } else if (ease <= Grade.FAIL) {
            expect(card.queue).toBe(Queue.LEARN);
            expect(card.cardType).toBe(CardType.LEARN);
        }
    }
    const nullCard = deck.scheduler.getCard();
    expect(nullCard).toBeNull();
}

test('Easy', () => {
    const deck = generateTestDeckAnki();
    answerNewCardsAnki(deck, Grade.GREAT);
    // If the cards are easy, they go right to the review queue, but not available now
    expect(deck.scheduler.learnQueue.length).toBe(0);
    const badCard = deck.scheduler.getCard();
    expect(badCard).toBeNull();
});

test('Good, Good', () => {
    const deck = generateTestDeckAnki();
    answerNewCardsAnki(deck, Grade.GOOD);
    // Those cards should now be in the learn queue
    const newPerDay = deck.scheduler.deckNewLimit;
    expect(deck.scheduler.learnQueue.length).toBe(newPerDay);
    answerLearnCardsAnki(deck, Grade.GOOD);
    // Now they should be in the review queue, but not available now
    expect(deck.scheduler.learnQueue.length).toBe(0);
    const badCard = deck.scheduler.getCard();
    expect(badCard).toBeNull();
});

test('fuzzedIntervalRange(4)', () => {
    const minMax = BaseScheduler.fuzzedIntervalRange(4);
    expect(minMax[0]).toBe(3);
    expect(minMax[1]).toBe(5);
});

test('fuzzedIntervalRange(1)', () => {
    const minMax = BaseScheduler.fuzzedIntervalRange(1);
    expect(minMax[0]).toBe(1);
    expect(minMax[1]).toBe(1);
});

test('deck.fuzzedInterval(4)', () => {
    const deck = generateTestDeckAnki();
    // fuzzed interval consumes a random
    testRandom.appendRandom([0]);
    const interval = deck.scheduler.fuzzedInterval(4);
    expect(interval).toBe(3);
})

test('deck.fuzzedInterval(1)', () => {
    const deck = generateTestDeckAnki();
    // fuzzed interval consumes a random
    testRandom.appendRandom([0]);
    const interval = deck.scheduler.fuzzedInterval(1);
    expect(interval).toBe(1);
})

test('Good; card properties correct', () => {
    const deck = generateTestDeckAnki();
    answerNewCardsAnki(deck, Grade.GOOD);
    // Those cards should now be in the learn queue
    const newPerDay = deck.scheduler.deckNewLimit;
    expect(deck.scheduler.learnQueue.length).toBe(newPerDay);
    const card = deck.scheduler.getCard();
    expect(card.left).toBe(1);
    expect(card.leftToday).toBe(1);
    expect(card.queue).toBe(Queue.LEARN);
    expect(card.cardType).toBe(CardType.LEARN);
    expect(deck.scheduler.newConfig.delays[1]).toBe(10);
    expect(card.due).toBe(Math.floor(startingDateMillis / 1000) + 60 * deck.scheduler.newConfig.delays[1]);
});

test('Good, Good; card properties correct', () => {
    const deck = generateTestDeckAnki();
    answerNewCardsAnki(deck, Grade.GOOD);
    // Those cards should now be in the learn queue
    const newPerDay = deck.scheduler.deckNewLimit;
    expect(deck.scheduler.learnQueue.length).toBe(newPerDay);
    const card = deck.scheduler.getCard();
    testRandom.appendRandom([0]); // rescheduleLearnCard consumes a random
    deck.scheduler.answerCard(card, Grade.GOOD);
    console.log(card);
    expect(card.left).toBe(1);
    expect(card.leftToday).toBe(1);
    expect(card.queue).toBe(Queue.REVIEW);
    expect(card.cardType).toBe(CardType.REVIEW);
    //expect(card.interval).toBe(1);
    //expect(card.due).toBe(CardType.REVIEW);
    expect(deck.scheduler.newConfig.initialFactor).toBe(2500);
    expect(card.factor).toBe(deck.scheduler.newConfig.initialFactor);
    testRandom.appendRandom([0]); // rescheduleLearnCard consumes a random
});

test('Easy, card properties correct', () => {
    const deck = generateTestDeckAnki();
    answerNewCardsAnki(deck, Grade.GREAT);
    // Those cards should now be in the learn queue
    const card = deck.scheduler.getCard();
    expect(card).toBeNull();
});

test('Hard, Good, Good', () => {
    const deck = generateTestDeckAnki();
    answerNewCardsAnki(deck, Grade.PASS);
    // Those cards should now be in the learn queue
    const newPerDay = deck.scheduler.deckNewLimit;
    expect(deck.scheduler.learnQueue.length).toBe(newPerDay);
    answerLearnCardsAnki(deck, Grade.PASS);
    // Now they should still be in the learn queue
    expect(deck.scheduler.learnQueue.length).toBe(newPerDay);
    answerLearnCardsAnki(deck, Grade.GOOD, false);
    // Now they should be in the learn queue
    expect(deck.scheduler.learnQueue.length).toBe(newPerDay);
    answerLearnCardsAnki(deck, Grade.GOOD, true);
    // Now they should be in the review queue
    expect(deck.scheduler.learnQueue.length).toBe(0);
    const badCard = deck.scheduler.getCard();
    expect(badCard).toBeNull();
});

test('Fail, Good, Good', () => {
    const deck = generateTestDeckAnki();
    answerNewCardsAnki(deck, Grade.FAIL);
    // Those cards should now be in the learn queue
    const newPerDay = deck.scheduler.deckNewLimit;
    expect(deck.scheduler.learnQueue.length).toBe(newPerDay);
    answerLearnCardsAnki(deck, Grade.FAIL);
    // Now they should still be in the learn queue
    expect(deck.scheduler.learnQueue.length).toBe(newPerDay);
    answerLearnCardsAnki(deck, Grade.GOOD, false);
    // Now they should be in the learn queue (for the second good answer)
    expect(deck.scheduler.learnQueue.length).toBe(newPerDay);
    answerLearnCardsAnki(deck, Grade.GOOD, true);
    // Now they should be in the review queue
    expect(deck.scheduler.learnQueue.length).toBe(0);
    const badCard = deck.scheduler.getCard();
    expect(badCard).toBeNull();
});


test('Ensure startingLeft == 2,2', () => {
    const deck = generateTestDeckAnki();
    const card = deck.scheduler.getCard();
    expect(card).not.toBeNull();
    expect(card.queue).toBe(Queue.NEW);
    expect(card.left).toBe(0); // initially unset
    // we will move the card to the learn queue, and reschedule it; supply the random we need to randomize the due date
    testRandom.appendRandom([0]);
    // This actually sets the card.left to 2,2 (startingLeft), then 1,1 (since we move it from new to learn, then call moveToNextStep)
    deck.scheduler.answerCard(card, Grade.GOOD);
    expect(card.queue).toBe(Queue.LEARN);
    expect(card.left).toBe(1);
    expect(card.leftToday).toBe(1);
});

test('Ensure startingLeft == 2002', () => {
    const deck = generateTestDeckAnki();
    const card = deck.scheduler.getCard();
    expect(card).not.toBeNull();
    expect(card.queue).toBe(Queue.NEW);
    expect(card.left).toBe(0); // initially unset
    // we will move the card to the learn queue, and reschedule it; supply the random we need to randomize the due date
    testRandom.appendRandom([0]);
    // This actually sets the card.left to 2,2 (startingLeft), then 1,1 (since we move it from new to learn, then call moveToNextStep)
    deck.scheduler.answerCard(card, Grade.GOOD);
    expect(card.queue).toBe(Queue.LEARN);
    expect(card.left).toBe(1);
    expect(card.leftToday).toBe(1);

    // FIXME: Don't pack two values in card.left
});

test('Good; SM2 card properties correct', () => {
    const deck = generateTestDeckSM2();
    answerNewCardsSM2(deck, Grade.GOOD);
    // Those cards should now be in the learn queue
    const newPerDay = deck.scheduler.deckNewLimit;
    //expect(deck.scheduler.learnQueue.length).toBe(newPerDay);
    const card = deck.scheduler.getCard();
    expect(card).toBeNull();
    //expect(card.queue).toBe(Queue.REVIEW);
    //expect(card.cardType).toBe(CardType.REVIEW);
    //expect(card.due).toBe(Math.floor(startingDateMillis / 1000) + 60);
});