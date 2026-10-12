class Deck{
    constructor(cards){
        if (!(Array.isArray(cards))) {
            throw new Error("Not an array of cards");
        }
        this.cards = cards.slice();
    }
    
    draw(){
        if (this.cards.length == 0) {
            throw new Error("Deck is empty");
        }

        return this.cards.pop();
    }

    shuffle(){
        for (let i = this.cards.length - 1; i > 0; i--) {
            
            let j = Math.floor(Math.random() * (i + 1));

            let temp = this.cards[i];
            this.cards[i] = this.cards[j];
            this.cards[j] = temp;
        }
    }
}

module.exports = {Deck};