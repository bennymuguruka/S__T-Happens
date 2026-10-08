const {supabase} = require("./supabaseClient");
const {Card} = require("./cards");

async function getCards() {
    const {data, error} = await supabase.from("cards").select("id, scenario_text, misery_index");

    if (error) {
        throw new Error(`Failed to load cards: ${error.message}`);    
    }

    return data.map((row) => new Card(row.id, row.scenario_text, row.misery_index));
}

module.exports = {getCards};