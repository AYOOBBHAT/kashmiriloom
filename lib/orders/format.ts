export function formatOrderTime(value: string): string {
  if (!value) {
    return "Not recorded";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export function formatPhone(phone: string): string {
  if (!/^[6-9][0-9]{9}$/.test(phone)) {
    return phone;
  }
  return `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`;
}
