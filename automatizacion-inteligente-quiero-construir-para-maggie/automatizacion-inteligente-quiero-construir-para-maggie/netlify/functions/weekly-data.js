const { weeklyData } = require("./lib/make-data");

exports.handler = async (event) => {
  try {
    return await weeklyData(event);
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
