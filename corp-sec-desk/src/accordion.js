/* FAQ accordion. Built on <details>/<summary>, so it is fully readable
   with JavaScript disabled and keyboard operable natively (Tab to focus,
   Enter/Space to toggle). This enhancement just keeps one item open at
   a time. */
export function initAccordion() {
  const items = document.querySelectorAll(".accordion-item");
  items.forEach((item) => {
    item.addEventListener("toggle", () => {
      if (!item.open) return;
      items.forEach((other) => {
        if (other !== item) other.open = false;
      });
    });
  });
}
