import Image from "next/image";
import type { MenuCategory } from "@/types/menu";

export default function MenuSection({
  category,
  searchQuery,
}: {
  category: MenuCategory;
  searchQuery: string;
}) {
  const filtered = searchQuery
    ? category.items.filter(
        (item) =>
          item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.desc?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : category.items;

  if (filtered.length === 0) return null;

  return (
    <div
      id={category.id}
      style={{
        marginBottom: "24px",
        borderRadius: "4px",
        border: "1px solid rgba(0, 0, 0, 0.125)",
        overflow: "hidden",
      }}
    >
      {/* Category header */}
      <div
        style={{
          backgroundColor: "rgb(247, 247, 244)",
          padding: "12px 16px",
          fontSize: "15px",
          fontWeight: 400,
          color: "rgb(33, 37, 41)",
          borderRadius: "3px 3px 0 0",
          textAlign: "center",
        }}
      >
        {category.category}
      </div>

      {/* Items */}
      {filtered.map((item, idx) => (
        <div
          key={idx}
          style={{
            borderBottom:
              idx < filtered.length - 1
                ? "1px solid rgba(0, 0, 0, 0.085)"
                : "none",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              padding: "5px 0 7px 4px",
              margin: "5px 0 10px",
            }}
          >
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              {/* Image */}
              <div style={{ flexShrink: 0 }}>
                {item.img ? (
                  <Image
                    src={item.img}
                    alt={item.name ?? "Item image"}
                    width={75}
                    height={75}
                    style={{ borderRadius: "5px", objectFit: "cover" }}
                    unoptimized
                  />
                ) : (
                  <div
                    style={{
                      width: "75px",
                      height: "75px",
                      borderRadius: "5px",
                      border: "1px solid rgb(220, 220, 220)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "rgb(144, 144, 144)",
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M8 12h8M12 8l4 4-4 4" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "15px",
                    color: "rgb(33, 37, 41)",
                    marginBottom: "2px",
                    paddingRight: "12px",
                  }}
                >
                  {item.name}
                </div>
                {item.desc && (
                  <div
                    style={{
                      fontSize: "15px",
                      color: "rgb(144, 144, 144)",
                    }}
                  >
                    {item.desc}
                  </div>
                )}
                <div
                  style={{
                    fontSize: "15px",
                    color: "rgb(33, 37, 41)",
                    marginTop: "8px",
                  }}
                >
                  {item.price}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
