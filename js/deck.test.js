import { Deck } from "./deck";
import { Logger, TestRandom, TestDateUtil } from "./utils";
import { MusicCard } from "./musiccard";

let testRandom = new TestRandom();
testRandom.appendRandom([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
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

    const deck = new Deck(cards, new Logger(), testRandom, testDateUtil);
    return deck;
}

test('Checks that new deck has 42 cards', () => {
    const deck = generateTestDeck();
    expect(deck.cards.length).toBe(42);
});
