(function () {
  try {
    var t = localStorage.getItem("theme");
    var d = t === "dark";
    var r = document.documentElement;
    r.classList.toggle("dark", d);
    r.style.colorScheme = d ? "dark" : "light";
  } catch (e) {}
})();
