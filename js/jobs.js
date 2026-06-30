// Jobs laden – später aus Supabase
// TODO: Jobs aus der Datenbank laden und ins Grid rendern

// Beispiel für später:
// async function ladeJobs() {
//   const { data, error } = await supabase.from('jobs').select('*').eq('aktiv', true);
//   if (error) return console.error(error);
//   renderJobs(data);
// }
