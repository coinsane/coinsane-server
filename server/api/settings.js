function getSettings(req, res) {
  return res.send({
    success: true,
    result: {
      settings: req.user.settings,
    }
  });
}

module.exports = {
  getSettings,
};
