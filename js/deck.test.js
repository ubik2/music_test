import { Deck, Ease } from "./deck";
import { Logger, DummyLogger, TestRandom, TestDateUtil } from "./utils";
import { MusicCard } from "./musiccard";
import { Queue } from "./card";
import { Config } from "./config";

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

test('Ensure we can answer 4 new cards and they are moved to the learn queue', () => {
    const deck = generateTestDeck();
    const newPerDay = deck.deckNewLimit();
    expect(newPerDay).toBe(4); // deck new limit should be 4
    for (let i = 0; i < newPerDay; i++) {
        const card = deck.getCard();
        expect(card).not.toBeNull();
        expect(card.queue).toBe(Queue.NEW);
        // we will move the card to the learn queue, and reschedule it; supply the random we need to randomize the due date
        testRandom.appendRandom([0]);
        deck.answerCard(card, Ease.GOOD);
        expect(card.queue).toBe(Queue.LEARN);
    }
    // we should have all those cards in the learn queue now
    expect(deck.learnQueue.length).toBe(newPerDay);
    // we will shuffle the learnQueue, so provide enough randomness for that (this will not change the order)
    testRandom.appendRandom(Array(deck.learnQueue.length).fill(0));
    for (let i = 0; i < newPerDay; i++) {
        const card = deck.getCard();
        expect(card).not.toBeNull();
        expect(card.queue).toBe(Queue.LEARN);
        deck.answerCard(card, Ease.GOOD);
    }
    const badCard = deck.getCard();
    expect(badCard).toBeNull();
});


test('Ensure startingLeft == 2002', () => {
    const deck = generateTestDeck();
    const card = deck.getCard();
    expect(card).not.toBeNull();
    expect(card.queue).toBe(Queue.NEW);
    expect(card.left).toBe(0); // initially unset
    // we will move the card to the learn queue, and reschedule it; supply the random we need to randomize the due date
    testRandom.appendRandom([0]);
    // This actually sets the card.left to 2002 (startingLeft), then 1001 (since we move it from new to learn, then call moveToNextStep)
    deck.answerCard(card, Ease.GOOD);
    expect(card.queue).toBe(Queue.LEARN);
    expect(card.left).toBe(1001);
    // FIXME: Don't pack two values in card.left
});
