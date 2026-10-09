import assert from "node:assert/strict";
import test from "node:test";
import contactValidation from "../backend/services/customerContactValidationService.js";

test("telefone aceita somente 10 ou 11 dígitos com DDD", () => {
  assert.equal(contactValidation.phoneDigits("11987654321"), "11987654321");
  assert.equal(contactValidation.phoneDigits("1134567890"), "1134567890");
  assert.equal(contactValidation.phoneDigits(""), "");
  for (const value of ["1198765432a", "(11) 98765-4321", "119876543", "119876543210"]) {
    assert.throws(() => contactValidation.phoneDigits(value), { code: "CUSTOMER_PHONE_INVALID", statusCode: 422 });
  }
});

test("CPF aceita somente 11 dígitos, mantendo ausência opcional", () => {
  assert.equal(contactValidation.cpfDigits("12345678901"), "12345678901");
  assert.equal(contactValidation.cpfDigits(""), "");
  for (const value of ["123.456.789-01", "1234567890x", "1234567890", "123456789012"]) {
    assert.throws(() => contactValidation.cpfDigits(value), { code: "CUSTOMER_CPF_INVALID", statusCode: 422 });
  }
});
