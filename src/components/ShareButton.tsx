"use client";

export default function ShareButton() {
  function handleShare() {
    if (navigator.share) {
      navigator.share({ title: "Grill Central", url: window.location.href });
    } else {
      navigator.clipboard?.writeText(window.location.href);
    }
  }

  return (
    <button
      onClick={handleShare}
      style={{
        position: "absolute",
        top: "36px",
        right: "20px",
        zIndex: 998,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: "30px",
        height: "30px",
        background: "none",
        border: "none",
        color: "rgb(24, 188, 156)",
        fontSize: "24px",
        cursor: "pointer",
      }}
      aria-label="Compartilhar"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" />
      </svg>
    </button>
  );
}
