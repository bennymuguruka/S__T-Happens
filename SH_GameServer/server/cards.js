class Card{
    constructor(cardID, scenarioText, miseryIndex){
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (typeof(cardID) === "string" && uuidPattern.test(cardID)) {
            this.cardID = cardID;
        }
        else{
            throw new Error("Card ID should be a uuid");
        }

        if((typeof(scenarioText) == "string") && (scenarioText.trim() !== "")){
            this.scenarioText = scenarioText.trim();
        }
        else{
            throw new Error("Scenario Text has to be a valid string");
        }

        if(!Number.isFinite(miseryIndex)){
            throw new Error("Misery Index must be a finite number");
        }
        else if(miseryIndex<0 || miseryIndex > 100){
            throw new Error("Misery Index must be between 0 and 100");
        }
        
        const scaled = miseryIndex * 10;
        const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled))* 4;

        if (Math.abs(scaled-Math.round(scaled)) > tolerance) {
            throw new Error("Misery Index should have one decimal place");
        }

        this.miseryIndex = miseryIndex;

    }
}

module.exports = {Card};