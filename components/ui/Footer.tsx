import { BimahLogoWithText } from "./BimahLogoWithText";

export function Footer() {
  return (
    <footer className="py-6 border-t border-slate-200 bg-transparent">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-600">
          <div className="flex items-center gap-3">
            <BimahLogoWithText
              logoSize={18}
              textClassName="font-mono text-lg tracking-tight text-[#1886d9]"
            />
            <span>•</span>
            <span>Analytics for Synagogues</span>
          </div>
          <div>
            <span>© {new Date().getFullYear()}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
