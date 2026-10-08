const { getCards } = require("./card-repository");

async function main() {
    const cards = await getCards();
    console.log("Cards loaded:", cards.length);
    console.log(cards[0]);
}

main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});