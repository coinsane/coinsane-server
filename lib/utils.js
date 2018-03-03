module.exports = {
  getMinMaxAvg
}

function getMinMaxAvg(arr) {
  let max = arr[0] || 0;
  let min = arr[0] || 0;
  let sum = arr[0] || 0;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > max) max = arr[i];
    if (arr[i] < min) min = arr[i];
    sum = sum + arr[i];
  }
  return { min, max, avg: sum / arr.length }
}
