import Image from "next/image";

export default function Header() {
  return (
    <div
      className="relative w-full"
      style={{
        height: "250px",
        marginBottom: "35px",
        backgroundImage: "url('/images/header-banner.png')",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        backgroundSize: "contain",
      }}
    >
      <div
        className="relative h-full mx-auto px-4"
        style={{ maxWidth: "1140px" }}
      >
        <Image
          src="/images/restaurant-logo.jpeg"
          alt="Logo"
          width={120}
          height={120}
          className="absolute"
          style={{
            bottom: "-30px",
            left: "15px",
            borderRadius: "5px",
          }}
        />
      </div>
    </div>
  );
}
