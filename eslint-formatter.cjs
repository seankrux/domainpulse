module.exports = function (results) {
  let output = '';
  
  for (const result of results) {
    if (result.messages.length === 0) continue;
    
    output += `${result.filePath}\n`;
    
    for (const msg of result.messages) {
      const line = msg.line || 0;
      const col = msg.column || 0;
      const severity = msg.severity === 2 ? 'error' : 'warning';
      output += `  ${line}:${col}  ${severity}  ${msg.message}  ${msg.ruleId || ''}\n`;
    }
  }
  
  return output || 'No issues found.';
};
