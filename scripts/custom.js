// const buttons = document.querySelectorAll(".button--primary");

// const getDirection = (event, element) => {
//   const rect = element.getBoundingClientRect();

//   const x = event.clientX - rect.left;
//   const y = event.clientY - rect.top;

//   const distances = {
//     top: y,
//     right: rect.width - x,
//     bottom: rect.height - y,
//     left: x,
//   };

//   return Object.entries(distances).reduce((closest, current) =>
//     current[1] < closest[1] ? current : closest
//   )[0];
// };

// const positions = {
//   top: {
//     x: "-50%",
//     y: "-125%",
//     rotate: "180deg",
//   },

//   right: {
//     x: "50%",
//     y: "-50%",
//     rotate: "-90deg",
//   },

//   bottom: {
//     x: "-50%",
//     y: "25%",
//     rotate: "0deg",
//   },

//   left: {
//     x: "-150%",
//     y: "-50%",
//     rotate: "90deg",
//   },
// };

// buttons.forEach((button) => {
//   button.addEventListener("mouseenter", (event) => {
//     const direction = getDirection(event, button);
//     const position = positions[direction];

//     button.classList.remove("is-fill-active");
//     button.classList.add("is-fill-static");

//     button.style.setProperty("--button-fill-x", position.x);
//     button.style.setProperty("--button-fill-y", position.y);
//     button.style.setProperty("--button-fill-rotate", position.rotate);

//     button.offsetWidth;

//     button.classList.remove("is-fill-static");

//     requestAnimationFrame(() => {
//       requestAnimationFrame(() => {
//         button.classList.add("is-fill-active");
//       });
//     });
//   });

//   button.addEventListener("mouseleave", (event) => {
//     const direction = getDirection(event, button);
//     const position = positions[direction];

//     button.style.setProperty("--button-fill-x", position.x);
//     button.style.setProperty("--button-fill-y", position.y);
//     button.style.setProperty("--button-fill-rotate", position.rotate);

//     button.classList.remove("is-fill-active");
//   });
// });