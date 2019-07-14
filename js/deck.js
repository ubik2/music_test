const Ease = {
    HARD: 2,
    GOOD: 3,
    EASY: 4
};

class Deck {
    /**
     * Create a new Deck
     * @param {Array.<Card>} cards cards to include in deck
     */
    constructor(cards) {
        this.cards = cards;
        this.newToday = 0;
        this.reviewToday = 0;
        this.learnToday = 0;
        //this.config = {
        //    new: {
        //        delays: [1, 10],
        //        intervals: [1, 4, 7],
        //        perDay: 20,
        //        bury: false
        //    },
        //    lapse: {
        //        delays: [10],
        //        multiple: 0,
        //        minInterval: 1,
        //        leechFails: 8,
        //        leechAction: 0 // 0 = suspend, 1 = tagonly
        //    },
        //    review: {
        //        perDay: 200,
        //        ease4: 1.3,
        //        fuzz: 0.05,
        //        bury: false,
        //        hardFactor: 1.2
        //    }
        //}
    }

    addCard(card) {
        this.cards.push(card);
        return this;
    }

    removeCard(card) {
        var index = this.cards.indexOf(card);
        if (index > -1) {
            this.cards.splice(index, 1);
        }
        return this;
    }

//    nextReviewInterval(card, ease, fuzz) {
//        var delay = card.daysLate;
//        var conf = this.config.review;
//        var factor = card.factor / 1000;
//        var hardFactor = this.config.review.hardFactor;
//        var minHard = (hardFactor > 1) ? card.interval : 0;
//    }
}