import { Deck } from "./deck";
import { Logger, DummyLogger, TestRandom, TestDateUtil } from "./utils";
import { MusicCard } from "./musiccard";
import { CardType, Queue } from "./card";
import { Ease } from "./base_scheduler";
import { AnkiScheduler } from "./anki_scheduler";

let testLogger = new DummyLogger();
let testRandom = new TestRandom();
let testDateUtil = new TestDateUtil();
testDateUtil.setNow(1563425466519);

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
    const deck = new Deck("C", cards, testLogger, testRandom, testDateUtil);
    return deck;
}

test('Checks that new deck has 42 cards', () => {
    const deck = generateTestDeck();
    expect(deck.cards.length).toBe(42);
});

test('Null shuffle', () => {
    const deck = generateTestDeck();
    const currentCards = deck.cards.slice(0, deck.cards.length);
    testRandom.appendRandom(Array(deck.cards.length).fill(0));
    const shuffledCards = deck.shuffledCards(deck.cards);
    expect(currentCards.length).toBe(deck.cards.length);
    expect(shuffledCards.length).toBe(deck.cards.length);
    for (let i = 0; i < currentCards.length; i++) {
        expect(currentCards[i].id).toBe(shuffledCards[i].id);
    }
});

function answerNewCards(deck, ease) {
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
        if (ease === Ease.EASY) {
            expect(card.queue).toBe(Queue.REVIEW);
            expect(card.cardType).toBe(CardType.REVIEW);
        } else if (ease === Ease.GOOD || ease === Ease.HARD) {
            expect(card.queue).toBe(Queue.LEARN);
            expect(card.cardType).toBe(CardType.LEARN);
        } else if (ease === Ease.FAIL) {
            expect(card.queue).toBe(Queue.LEARN);
            expect(card.cardType).toBe(CardType.LEARN);
        }
    }
}

function answerLearnCards(deck, ease, expectReview = true) {
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
        if (ease === Ease.GOOD || ease === Ease.EASY) {
            if (expectReview) {
                expect(card.queue).toBe(Queue.REVIEW);
                expect(card.cardType).toBe(CardType.REVIEW);
            } else {
                expect(card.queue).toBe(Queue.LEARN);
                expect(card.cardType).toBe(CardType.LEARN);
            }
        } else if (ease === Ease.HARD || ease === Ease.FAIL) {
            expect(card.queue).toBe(Queue.LEARN);
            expect(card.cardType).toBe(CardType.LEARN);
        }
    }
}

test('Easy', () => {
    const deck = generateTestDeck();
    answerNewCards(deck, Ease.EASY);
    // If the cards are easy, they go right to the review queue, but not available now
    expect(deck.scheduler.learnQueue.length).toBe(0);
    const badCard = deck.scheduler.getCard();
    expect(badCard).toBeNull();
});

test('Good, Good', () => {
    const deck = generateTestDeck();
    answerNewCards(deck, Ease.GOOD);
    // Those cards should now be in the learn queue
    const newPerDay = deck.scheduler.deckNewLimit;
    expect(deck.scheduler.learnQueue.length).toBe(newPerDay);
    answerLearnCards(deck, Ease.GOOD);
    // Now they should be in the review queue, but not available now
    expect(deck.scheduler.learnQueue.length).toBe(0);
    const badCard = deck.scheduler.getCard();
    expect(badCard).toBeNull();
});

test('Hard, Good, Good', () => {
    const deck = generateTestDeck();
    answerNewCards(deck, Ease.HARD);
    // Those cards should now be in the learn queue
    const newPerDay = deck.scheduler.deckNewLimit;
    expect(deck.scheduler.learnQueue.length).toBe(newPerDay);
    answerLearnCards(deck, Ease.HARD);
    // Now they should still be in the learn queue
    expect(deck.scheduler.learnQueue.length).toBe(newPerDay);
    answerLearnCards(deck, Ease.GOOD, false);
    // Now they should be in the learn queue
    expect(deck.scheduler.learnQueue.length).toBe(newPerDay);
    answerLearnCards(deck, Ease.GOOD, true);
    // Now they should be in the review queue
    expect(deck.scheduler.learnQueue.length).toBe(0);
    const badCard = deck.scheduler.getCard();
    expect(badCard).toBeNull();
});

test('Fail, Good, Good', () => {
    const deck = generateTestDeck();
    answerNewCards(deck, Ease.FAIL);
    // Those cards should now be in the learn queue
    const newPerDay = deck.scheduler.deckNewLimit;
    expect(deck.scheduler.learnQueue.length).toBe(newPerDay);
    answerLearnCards(deck, Ease.FAIL);
    // Now they should still be in the learn queue
    expect(deck.scheduler.learnQueue.length).toBe(newPerDay);
    answerLearnCards(deck, Ease.GOOD, false);
    // Now they should be in the learn queue (for the second good answer)
    expect(deck.scheduler.learnQueue.length).toBe(newPerDay);
    answerLearnCards(deck, Ease.GOOD, true);
    // Now they should be in the review queue
    expect(deck.scheduler.learnQueue.length).toBe(0);
    const badCard = deck.scheduler.getCard();
    expect(badCard).toBeNull();
});


test('Ensure startingLeft == 2002', () => {
    const deck = generateTestDeck();
    const card = deck.scheduler.getCard();
    expect(card).not.toBeNull();
    expect(card.queue).toBe(Queue.NEW);
    expect(card.left).toBe(0); // initially unset
    // we will move the card to the learn queue, and reschedule it; supply the random we need to randomize the due date
    testRandom.appendRandom([0]);
    // This actually sets the card.left to 2002 (startingLeft), then 1001 (since we move it from new to learn, then call moveToNextStep)
    deck.scheduler.answerCard(card, Ease.GOOD);
    expect(card.queue).toBe(Queue.LEARN);
    expect(card.left).toBe(1001);
    // FIXME: Don't pack two values in card.left
});

test('Ensure startingLeft == 2002', () => {
    const deck = generateTestDeck();
    const card = deck.scheduler.getCard();
    expect(card).not.toBeNull();
    expect(card.queue).toBe(Queue.NEW);
    expect(card.left).toBe(0); // initially unset
    // we will move the card to the learn queue, and reschedule it; supply the random we need to randomize the due date
    testRandom.appendRandom([0]);
    // This actually sets the card.left to 2002 (startingLeft), then 1001 (since we move it from new to learn, then call moveToNextStep)
    deck.scheduler.answerCard(card, Ease.GOOD);
    expect(card.queue).toBe(Queue.LEARN);
    expect(card.left).toBe(1001);
    // FIXME: Don't pack two values in card.left
});
