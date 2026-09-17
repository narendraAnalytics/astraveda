export const clerkAppearance = {
  variables: {
    colorPrimary: "#8F29DD",
    colorBackground: "#FFFFFF",
    colorForeground: "#1B1730",
    colorInputForeground: "#1B1730",
  },
  elements: {
    rootBox: "w-full",
    card: "w-full bg-transparent shadow-none p-0 gap-5",
    headerTitle:
      "font-[family-name:var(--font-display)] text-[26px] sm:text-[28px] font-medium text-[#1B1730]",
    headerSubtitle: "text-[13.5px] text-[#6B6478]",
    socialButtonsBlockButton:
      "h-11 rounded-[12px] border border-[rgba(27,23,48,.12)] bg-white hover:bg-[#F8F5FF] transition-colors text-[13.5px] font-medium text-[#1B1730]",
    socialButtonsBlockButtonText: "text-[13.5px] font-medium",
    dividerRow: "my-1",
    dividerLine: "bg-[rgba(27,23,48,.12)]",
    dividerText: "text-[12px] text-[#8A8398]",
    formFieldLabel: "text-[12.5px] font-semibold text-[#1B1730]",
    formFieldInput:
      "h-12 rounded-[12px] border border-[rgba(27,23,48,.14)] bg-white px-4 text-[15px] text-[#1B1730] focus:border-[#8F29DD] focus:ring-2 focus:ring-[rgba(143,41,221,.15)]",
    formButtonPrimary:
      "h-12 rounded-[100px] normal-case font-semibold text-[14.5px] text-[#241505] bg-[linear-gradient(180deg,#F7DDA2,#E9BE6C)] shadow-[0_8px_22px_rgba(244,210,138,.4)] hover:brightness-[1.03] transition-[filter]",
    footerActionLink: "text-[#8F29DD] font-semibold hover:text-[#7420c4]",
    footerActionText: "text-[13.5px] text-[#6B6478]",
    formResendCodeLink: "text-[#8F29DD] font-semibold",
    otpCodeFieldInput: "border-[rgba(27,23,48,.14)] text-[#1B1730]",
    footer: "mt-1",
  },
};
