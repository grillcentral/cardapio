export default function CartSidebar() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: "white",
        borderRadius: "4px",
        border: "1px solid rgba(0, 0, 0, 0.125)",
        width: "100%",
      }}
    >
      {/* Cart header */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 20px",
          backgroundColor: "rgba(0, 0, 0, 0.03)",
          borderRadius: "3px 3px 0 0",
          borderBottom: "1px solid rgba(0, 0, 0, 0.125)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
          <span style={{ fontSize: "15px", fontWeight: 400 }}>Carrinho</span>
        </div>
      </div>

      {/* Cart body - empty state */}
      <div
        style={{
          padding: "20px",
          fontSize: "15px",
          color: "rgb(33, 37, 41)",
          textAlign: "center",
        }}
      >
        Sem itens no carrinho!
      </div>
    </div>
  );
}
