const { markMonthlyContactedData } = require("./lib/make-data");

exports.handler = async (event) => {
  try {
    return await markMonthlyContactedData(event);
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: `No se pudo marcar como contactado: ${error.message}`,
    };
  }
};
