// Every section uses this header so titles line up on the same left edge
// with the same spacing all the way down the page.
const SectionHeader = ({ title, subtitle, children }) => (
  <div className="mb-10 md:mb-14 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
    <div className="max-w-2xl">
      <h2 data-reveal className="section-heading">
        {title}
      </h2>
      {subtitle && (
        <p data-reveal data-reveal-delay="0.1" className="section-subtitle">
          {subtitle}
        </p>
      )}
    </div>
    {children && <div data-reveal data-reveal-delay="0.2">{children}</div>}
  </div>
);

export default SectionHeader;
