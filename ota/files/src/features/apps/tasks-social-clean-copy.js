// Tasks social UI cleanup: keep technical reward-verification details out of user-facing copy.
const style = document.createElement('style');
style.id = 'nx-tasks-social-clean-copy-v1';
style.textContent = `
  .nx-tasks-premium .nx-community-security,
  .nx-follow-gate .nx-follow-gate__trust {
    display:none!important;
  }
`;
document.head.appendChild(style);
