import { Deck } from "./deck";
import { Logger, DummyLogger, TestRandom, TestDateUtil } from "./utils";
import { MusicCard } from "./music_card";
import { CardType, Queue } from "./card";
import { Grade, BaseScheduler } from "./base_scheduler";
import { SuperMemoScheduler } from "./supermemo_scheduler";
import { SuperMemoAnkiScheduler } from "./supermemo_anki_scheduler";

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

function generateTestDeckSM2() {
    const deck = generateTestDeck();
    deck.scheduler = new SuperMemoScheduler(deck, deck.logger, deck.random, deck.dateUtil);
    for (var card of deck.cards) {
        expect(card.queue).toBe(Queue.NEW);
        expect(card.cardType).toBe(CardType.NEW);
    }
    return deck;
}


function generateTestDeckAnki() {
    const deck = generateTestDeck();
    deck.scheduler = new SuperMemoAnkiScheduler(deck, deck.logger, deck.random, deck.dateUtil);
    for (var card of deck.cards) {
        expect(card.queue).toBe(Queue.NEW);
        expect(card.cardType).toBe(CardType.NEW);
    }
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

function answerNewCardsSM2(deck, ease) {
    const newPerDay = deck.scheduler.deckNewLimit;
    expect(newPerDay).toBe(4); // deck new limit should be 4
    deck.scheduler.fillQueues();
    expect(deck.scheduler.newQueue.length).toBe(newPerDay);
    expect(deck.scheduler.learnQueue.length).toBe(0);
    expect(deck.scheduler.reviewQueue.length).toBe(0);
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
    if (ease >= Grade.PASS) {
        const nullCard = deck.scheduler.getCard();
        expect(nullCard).toBeNull();
    } else {
        const nonNullCard = deck.scheduler.getCard();
        expect(nonNullCard).not.toBeNull();
    }
}

function answerNewCardsAnki(deck, ease) {
    const newPerDay = deck.scheduler.deckNewLimit;
    expect(newPerDay).toBe(4); // deck new limit should be 4
    deck.scheduler.fillQueues();
    expect(deck.scheduler.newQueue.length).toBe(newPerDay);
    expect(deck.scheduler.learnQueue.length).toBe(0);
    expect(deck.scheduler.reviewQueue.length).toBe(0);
    for (let i = 0; i < newPerDay; i++) {
        const card = deck.scheduler.getCard();
        expect(card).not.toBeNull();
        expect(card.queue).toBe(Queue.NEW);
        expect(card.cardType).toBe(CardType.NEW);
        // we will move the card to the learn queue, and reschedule it
        deck.scheduler.answerCard(card, ease);
        if (ease >= Grade.GREAT) {
            expect(card.queue).toBe(Queue.REVIEW);
            expect(card.cardType).toBe(CardType.REVIEW);
        } else {
            expect(card.queue).toBe(Queue.LEARN);
            expect(card.cardType).toBe(CardType.LEARN);
        }
    }
}

function answerLearnCardsAnki(deck, ease) {
    const newPerDay = deck.scheduler.deckNewLimit;
    // we should have all those cards in the learn queue now
    //expect(deck.scheduler.learnQueue.length).toBe(newPerDay);
    let minRepetitions = undefined;
    for (let i = 0; i < newPerDay; i++) {
        const card = deck.scheduler.getCard();
        const repetitions = card.repetitions;
        minRepetitions = (minRepetitions === undefined) ? repetitions : Math.min(repetitions, minRepetitions);
        expect(card).not.toBeNull();
        expect(card.queue).toBe(Queue.LEARN);
        expect(card.cardType).toBe(CardType.LEARN);
        deck.scheduler.answerCard(card, ease);
        if (ease >= Grade.GREAT || (ease >= Grade.GOOD && repetitions === 2)) {
            expect(card.queue).toBe(Queue.REVIEW);
            expect(card.cardType).toBe(CardType.REVIEW);
        } else {
            expect(card.queue).toBe(Queue.LEARN);
            expect(card.cardType).toBe(CardType.LEARN);
        }
    }
    if (ease >= Grade.GREAT || (ease >= Grade.GOOD && minRepetitions === 2)) {
        const nullCard = deck.scheduler.getCard();
        expect(nullCard).toBeNull();
    } else {
        const nonNullCard = deck.scheduler.getCard();
        expect(nonNullCard).not.toBeNull();
    }
}

test('Easy SM2', () => {
    const deck = generateTestDeckSM2();
    answerNewCardsSM2(deck, Grade.GREAT);
    // If the cards are easy, they go right to the review queue, but not available now
    expect(deck.scheduler.learnQueue.length).toBe(0);
    const badCard = deck.scheduler.getCard();
    expect(badCard).toBeNull();
});

test('Easy', () => {
    const deck = generateTestDeckAnki();
    answerNewCardsAnki(deck, Grade.GREAT);
    // If the cards are easy, they go right to the review queue, but not available now
    expect(deck.scheduler.learnQueue.length).toBe(0);
    const badCard = deck.scheduler.getCard();
    expect(badCard).toBeNull();
});

test('Fail, Good SM2', () => {
    const deck = generateTestDeckSM2();
    answerNewCardsSM2(deck, Grade.FAIL);
    // Those cards should now be in the learn queue
    const newPerDay = deck.scheduler.deckNewLimit;
    expect(deck.scheduler.learnQueue.length).toBe(newPerDay);
    answerLearnCardsSM2(deck, Grade.GOOD);
    // Now they should be in the review queue, but not available now
    expect(deck.scheduler.learnQueue.length).toBe(0);
    const badCard = deck.scheduler.getCard();
    expect(badCard).toBeNull();
});

test('Fail, Good', () => {
    const deck = generateTestDeckAnki();
    answerNewCardsAnki(deck, Grade.FAIL);
    // Those cards should now be in the learn queue
    const newPerDay = deck.scheduler.deckNewLimit;
    expect(deck.scheduler.learnQueue.length).toBe(newPerDay);
    answerLearnCardsAnki(deck, Grade.GOOD);
    // Now they should be in the learn queue
    expect(deck.scheduler.learnQueue.length).toBe(4);
    const goodCard = deck.scheduler.getCard();
    expect(goodCard).not.toBeNull();
});

test('Fail, Great', () => {
    const deck = generateTestDeckAnki();
    answerNewCardsAnki(deck, Grade.FAIL);
    // Those cards should now be in the learn queue
    const newPerDay = deck.scheduler.deckNewLimit;
    expect(deck.scheduler.learnQueue.length).toBe(newPerDay);
    answerLearnCardsAnki(deck, Grade.GREAT);
    // Now they should be in the review queue
    expect(deck.scheduler.learnQueue.length).toBe(0);
    const badCard = deck.scheduler.getCard();
    expect(badCard).toBeNull();
});

test('Good, Good SM2', () => {
    const deck = generateTestDeckSM2();
    answerNewCardsSM2(deck, Grade.GOOD);
    expect(deck.scheduler.learnQueue.length).toBe(0);
    const badCard = deck.scheduler.getCard();
    expect(badCard).toBeNull();
});

test('Good, Good', () => {
    const deck = generateTestDeckAnki();
    answerNewCardsAnki(deck, Grade.GOOD);
    expect(deck.scheduler.learnQueue.length).toBe(4);
    answerLearnCardsAnki(deck, Grade.GOOD);
    expect(deck.scheduler.learnQueue.length).toBe(4);
    const goodCard = deck.scheduler.getCard();
    expect(goodCard).not.toBeNull();
});

test('Good, Good, Good', () => {
    const deck = generateTestDeckAnki();
    answerNewCardsAnki(deck, Grade.GOOD);
    expect(deck.scheduler.learnQueue.length).toBe(4);
    answerLearnCardsAnki(deck, Grade.GOOD);
    expect(deck.scheduler.learnQueue.length).toBe(4);
    answerLearnCardsAnki(deck, Grade.GOOD);
    expect(deck.scheduler.learnQueue.length).toBe(0);
    const badCard = deck.scheduler.getCard(); // just review cards for tomorrow
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

// test('deck.fuzzedInterval(4)', () => {
//     const deck = generateTestDeckSM2();
//     // fuzzed interval consumes a random
//     testRandom.appendRandom([0]);
//     const interval = deck.scheduler.fuzzedInterval(4);
//     expect(interval).toBe(3);
// })

// test('deck.fuzzedInterval(1)', () => {
//     const deck = generateTestDeckSM2();
//     // fuzzed interval consumes a random
//     testRandom.appendRandom([0]);
//     const interval = deck.scheduler.fuzzedInterval(1);
//     expect(interval).toBe(1);
// })

test('Good SM2; card properties correct', () => {
    const deck = generateTestDeckSM2();
    answerNewCardsSM2(deck, Grade.GOOD);
    const card = deck.cards[0];
    expect(card.queue).toBe(Queue.REVIEW);
    expect(card.cardType).toBe(CardType.REVIEW);
    expect(card.eFactor).toBe(2.5 + (.1 - 1 * (.08 + 1 * .02))); // 2.7
    expect(card.due).toBe(Math.floor(deck.scheduler.today + 1));
});

test('Good; card properties correct', () => {
    const deck = generateTestDeckAnki();
    answerNewCardsAnki(deck, Grade.GOOD);
    const card = deck.cards[0];
    expect(card.queue).toBe(Queue.LEARN);
    expect(card.cardType).toBe(CardType.LEARN);
    expect(card.eFactor).toBe(2.5); // unchanged until review
    expect(card.due).toBe(Math.floor(deck.scheduler.intNow() + 600)); // Answering Good moves to 10 minute step
});

test('Good, Good, Good; card properties correct', () => {
    const deck = generateTestDeckAnki();
    answerNewCardsAnki(deck, Grade.GOOD);
    answerLearnCardsAnki(deck, Grade.GOOD);
    answerLearnCardsAnki(deck, Grade.GOOD);
    const card = deck.cards[0];
    expect(card.queue).toBe(Queue.REVIEW);
    expect(card.cardType).toBe(CardType.REVIEW);
    expect(card.eFactor).toBe(2.5 + (.1 - 1 * (.08 + 1 * .02))); // 2.7
    expect(card.due).toBe(Math.floor(deck.scheduler.today + 1));
});

test('Great; card properties correct', () => {
    const deck = generateTestDeckAnki();
    answerNewCardsAnki(deck, Grade.GREAT);
    const card = deck.cards[0];
    expect(card.queue).toBe(Queue.REVIEW);
    expect(card.cardType).toBe(CardType.REVIEW);
    expect(card.eFactor).toBe(2.5);
    expect(card.due).toBe(Math.floor(deck.scheduler.today + 1)); // 1 day later
});

test('Good, Great; card properties correct', () => {
    const deck = generateTestDeckAnki();
    answerNewCardsAnki(deck, Grade.GOOD);
    answerLearnCardsAnki(deck, Grade.GREAT);
    const card = deck.cards[0];
    expect(card.queue).toBe(Queue.REVIEW);
    expect(card.cardType).toBe(CardType.REVIEW);
    expect(card.eFactor).toBe(2.5);
    expect(card.due).toBe(Math.floor(deck.scheduler.today + 4)); // 4 days later
});

test('Fail SM2; card properties correct', () => {
    const deck = generateTestDeckSM2();
    answerNewCardsSM2(deck, Grade.FAIL);
    const card = deck.cards[0];
    expect(card.queue).toBe(Queue.LEARN);
    expect(card.cardType).toBe(CardType.LEARN);
    expect(card.eFactor).toBe(2.5 + (.1 - 3 * (.08 + 3 * .02))); // 2.9
    expect(card.due).toBe(Math.floor(startingDateMillis / 1000) + 1);
});

test('Fail; card properties correct', () => {
    const deck = generateTestDeckAnki();
    answerNewCardsAnki(deck, Grade.FAIL);
    const card = deck.cards[0];
    expect(card.queue).toBe(Queue.LEARN);
    expect(card.cardType).toBe(CardType.LEARN);
    expect(card.repetitions).toBe(0);
    expect(card.eFactor).toBe(2.5); // 2.5
    expect(card.due).toBe(Math.floor(startingDateMillis / 1000) + 60); // one minute
});

// test('Good; card properties correct', () => {
//     const deck = generateTestDeckSM2();
//     answerNewCardsAnki(deck, Grade.GOOD);
//     // Those cards should now be in the learn queue
//     const newPerDay = deck.scheduler.deckNewLimit;
//     expect(deck.scheduler.learnQueue.length).toBe(newPerDay);
//     const card = deck.scheduler.getCard();
//     expect(card.left).toBe(1);
//     expect(card.leftToday).toBe(1);
//     expect(card.queue).toBe(Queue.LEARN);
//     expect(card.cardType).toBe(CardType.LEARN);
//     expect(deck.scheduler.newConfig.delays[1]).toBe(10);
//     expect(card.due).toBe(Math.floor(startingDateMillis / 1000) + 60 * deck.scheduler.newConfig.delays[1]);
// });

// test('Good, Good; card properties correct', () => {
//     const deck = generateTestDeckSM2();
//     answerNewCardsAnki(deck, Grade.GOOD);
//     // Those cards should now be in the learn queue
//     const newPerDay = deck.scheduler.deckNewLimit;
//     expect(deck.scheduler.learnQueue.length).toBe(newPerDay);
//     const card = deck.scheduler.getCard();
//     testRandom.appendRandom([0]); // rescheduleLearnCard consumes a random
//     deck.scheduler.answerCard(card, Grade.GOOD);
//     console.log(card);
//     expect(card.left).toBe(1);
//     expect(card.leftToday).toBe(1);
//     expect(card.queue).toBe(Queue.REVIEW);
//     expect(card.cardType).toBe(CardType.REVIEW);
//     //expect(card.interval).toBe(1);
//     //expect(card.due).toBe(CardType.REVIEW);
//     expect(deck.scheduler.newConfig.initialFactor).toBe(2500);
//     expect(card.factor).toBe(deck.scheduler.newConfig.initialFactor);
//     testRandom.appendRandom([0]); // rescheduleLearnCard consumes a random
// });

test('Easy SM2; card properties correct', () => {
    const deck = generateTestDeckSM2();
    answerNewCardsSM2(deck, Grade.GREAT);
    // Those cards should now be in the learn queue
    const card = deck.scheduler.getCard();
    expect(card).toBeNull();
});

test('Easy; card properties correct', () => {
    const deck = generateTestDeckAnki();
    answerNewCardsAnki(deck, Grade.GREAT);
    // Those cards should now be in the learn queue
    const card = deck.scheduler.getCard();
    expect(card).toBeNull();
});

// test('Hard, Good, Good', () => {
//     const deck = generateTestDeckSM2();
//     answerNewCardsSM2(deck, Grade.PASS);
//     // Those cards should now be in the learn queue
//     const newPerDay = deck.scheduler.deckNewLimit;
//     expect(deck.scheduler.learnQueue.length).toBe(newPerDay);
//     answerLearnCardsSM2(deck, Grade.PASS);
//     // Now they should still be in the learn queue
//     expect(deck.scheduler.learnQueue.length).toBe(newPerDay);
//     answerLearnCardsSM2(deck, Grade.GOOD, false);
//     // Now they should be in the learn queue
//     expect(deck.scheduler.learnQueue.length).toBe(newPerDay);
//     answerLearnCardsSM2(deck, Grade.GOOD, true);
//     // Now they should be in the review queue
//     expect(deck.scheduler.learnQueue.length).toBe(0);
//     const badCard = deck.scheduler.getCard();
//     expect(badCard).toBeNull();
// });

test('Fail, Fail, Good', () => {
    const deck = generateTestDeckSM2();
    answerNewCardsSM2(deck, Grade.FAIL);
    // Those cards should now be in the learn queue
    const newPerDay = deck.scheduler.deckNewLimit;
    expect(deck.scheduler.learnQueue.length).toBe(newPerDay);
    answerLearnCardsSM2(deck, Grade.FAIL);
    // Now they should still be in the learn queue
    expect(deck.scheduler.learnQueue.length).toBe(newPerDay);
    answerLearnCardsSM2(deck, Grade.GOOD);
    // Now they should be in the review queue
    expect(deck.scheduler.learnQueue.length).toBe(0);
    const badCard = deck.scheduler.getCard();
    expect(badCard).toBeNull();
});


// test('Ensure startingLeft == 2,2', () => {
//     const deck = generateTestDeckAnki();
//     const card = deck.scheduler.getCard();
//     expect(card).not.toBeNull();
//     expect(card.queue).toBe(Queue.NEW);
//     expect(card.left).toBe(0); // initially unset
//     // we will move the card to the learn queue, and reschedule it; supply the random we need to randomize the due date
//     testRandom.appendRandom([0]);
//     // This actually sets the card.left to 2,2 (startingLeft), then 1,1 (since we move it from new to learn, then call moveToNextStep)
//     deck.scheduler.answerCard(card, Grade.GOOD);
//     expect(card.queue).toBe(Queue.LEARN);
//     expect(card.left).toBe(1);
//     expect(card.leftToday).toBe(1);
// });

// test('Ensure startingLeft == 2002', () => {
//     const deck = generateTestDeckAnki();
//     const card = deck.scheduler.getCard();
//     expect(card).not.toBeNull();
//     expect(card.queue).toBe(Queue.NEW);
//     expect(card.left).toBe(0); // initially unset
//     // we will move the card to the learn queue, and reschedule it; supply the random we need to randomize the due date
//     testRandom.appendRandom([0]);
//     // This actually sets the card.left to 2,2 (startingLeft), then 1,1 (since we move it from new to learn, then call moveToNextStep)
//     deck.scheduler.answerCard(card, Grade.GOOD);
//     expect(card.queue).toBe(Queue.LEARN);
//     expect(card.left).toBe(1);
//     expect(card.leftToday).toBe(1);

//     // FIXME: Don't pack two values in card.left
// });

test('Good; SM2 card properties correct', () => {
    const deck = generateTestDeckSM2();
    answerNewCardsSM2(deck, Grade.GOOD);
    // Those cards should now be in the review queue (but not in the reviewQueue array)
    deck.scheduler.fillQueues(); // invoke this manually, so we can check the queue lengths
    expect(deck.scheduler.newQueue.length).toBe(0);
    expect(deck.scheduler.learnQueue.length).toBe(0);
    expect(deck.scheduler.reviewQueue.length).toBe(0); // cards aren't due today
    const card = deck.scheduler.getCard();
    expect(card).toBeNull();
});

test('Fail; SM2 card properties correct', () => {
    const deck = generateTestDeckSM2();
    answerNewCardsSM2(deck, Grade.FAIL);
    // Those cards should now be in the learn queue
    const newPerDay = deck.scheduler.deckNewLimit;
    deck.scheduler.fillQueues(); // invoke this manually, so we can check the queue lengths
    expect(deck.scheduler.newQueue.length).toBe(0);
    expect(deck.scheduler.learnQueue.length).toBe(newPerDay);
    expect(deck.scheduler.reviewQueue.length).toBe(0);
    const card = deck.scheduler.getCard();
    expect(card.queue).toBe(Queue.LEARN);
    expect(card.cardType).toBe(CardType.LEARN);
    expect(card.due).toBe(Math.floor(startingDateMillis / 1000) + 1);
});