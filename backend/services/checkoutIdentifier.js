function checkoutIdentifier(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value)) {
    throw Object.assign(new Error("A referência da compra contém caracteres inválidos."), {
      statusCode: 422,
      code: "INVALID_CHECKOUT_IDENTIFIER"
    });
  }
  return value;
}

module.exports = { checkoutIdentifier };
