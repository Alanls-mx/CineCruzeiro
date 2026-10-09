function validationError(code, message) {
  return Object.assign(new Error(message), { code, statusCode: 422 });
}

function phoneDigits(value) {
  const phone = String(value ?? "");
  if (phone && !/^\d{10,11}$/.test(phone)) {
    throw validationError("CUSTOMER_PHONE_INVALID", "Informe um telefone com DDD, usando apenas 10 ou 11 números.");
  }
  return phone;
}

function cpfDigits(value) {
  const cpf = String(value ?? "");
  if (cpf && !/^\d{11}$/.test(cpf)) {
    throw validationError("CUSTOMER_CPF_INVALID", "Informe um CPF com 11 números, sem pontos ou traços.");
  }
  return cpf;
}

module.exports = { phoneDigits, cpfDigits };
