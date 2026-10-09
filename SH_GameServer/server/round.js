class Round{
    constructor(scenario_card,){
        this.scenario_card = scenario_card;
        this.submissions = new Map();
        this.isLocked = false;
    }

    submit(player, placement){
        if (this.isLocked) {
            throw new Error("Round is locked");
        }
        if (this.submissions.has(player.sessionToken)) {
            throw new Error("Player already submitted");
        }
        if(placement < 0 || placement > player.scale.length || !Number.isInteger(placement)){
            throw new Error("Invalid Placement");
        }
        this.submissions.set(player.sessionToken, {placement, submittedAt: performance.now()});
    }

    lock(){
        this.isLocked = true;
    }
}

module.exports = {Round};