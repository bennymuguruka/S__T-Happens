const {createClient} = require("@supabase/supabase-js");

const supabaseURL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_SUPABASE_SECRET_KEY;

if((supabaseURL === undefined) || (supabaseURL === "")){
    throw new Error("No database URL found");
}
if ((supabaseKey === undefined)|| (supabaseURL === "")) {
    throw new Error("No database Key found");
}

const supabase = createClient(supabaseURL, supabaseKey)

module.exports = {supabase};