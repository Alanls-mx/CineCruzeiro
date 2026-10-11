function sellableTomorrowSession(referenceDate = new Date()) {
  const date = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(referenceDate.getTime() + 86400000));
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    hourCycle: "h23"
  }).format(referenceDate);
  return { date, time: `${hour}:00` };
}

module.exports = { sellableTomorrowSession };
