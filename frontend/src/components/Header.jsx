import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";
import { shortenAddress } from "../utils/web3";

const WalletIcon = ({ size = 12 }) => (
  <svg
    className="app-wallet-icon"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
    <path d="M1 10h22" />
    <rect x="16" y="14" width="4" height="4" rx="1" />
  </svg>
);

const Header = () => {
  const {
    walletConnected,
    account,
    isWrongNetwork,
    connectWallet,
    disconnectWallet,
  } = useWallet();

  const location = useLocation();
  const isPublicSessionRoute = location.pathname.startsWith("/s/");

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  useEffect(() => {
    setDropdownOpen(false);
  }, [location.pathname]);

  const getNavClass = ({ isActive }) =>
    `nav-link app-nav-link${isActive ? " app-nav-link-active" : ""}`;

  return (
    <nav className="navbar navbar-expand-lg app-navbar">
      <div className="container-fluid">
        <Link
          className="navbar-brand app-brand"
          to={isPublicSessionRoute ? location.pathname : "/"}
        >
          <span className="app-brand-mark">VD</span>
          <span>
            <strong>Voting DApp</strong>
            <small className="app-brand-meta">On-chain voting</small>
          </span>
        </Link>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto app-nav-list align-items-lg-center">
            {!isPublicSessionRoute && (
              <>
                <li className="nav-item">
                  <NavLink className={getNavClass} to="/" end>
                    Voting
                  </NavLink>
                </li>

                <li className="nav-item">
                  <NavLink className={getNavClass} to="/results">
                    Results
                  </NavLink>
                </li>

                <li className="nav-item">
                  <NavLink className={getNavClass} to="/admin">
                    Admin Panel
                  </NavLink>
                </li>
              </>
            )}

            <li className="nav-item app-wallet-slot" ref={dropdownRef}>
              {walletConnected ? (
                <div className="app-wallet-dropdown-wrap">
                  <button
                    type="button"
                    className={`app-wallet-chip${isWrongNetwork ? " app-wallet-chip-warning" : ""}${dropdownOpen ? " app-wallet-chip-open" : ""}`}
                    onClick={() => setDropdownOpen((v) => !v)}
                    aria-haspopup="true"
                    aria-expanded={dropdownOpen}
                  >
                    <span className="app-wallet-state">
                      <span
                        className={`app-wallet-dot${isWrongNetwork ? " app-wallet-dot-warning" : ""}`}
                      />
                      <WalletIcon size={12} />
                      {isWrongNetwork ? "Wrong network" : "Connected"}
                    </span>
                    <strong>{shortenAddress(account)}</strong>
                    <svg
                      className={`app-wallet-chevron${dropdownOpen ? " app-wallet-chevron-open" : ""}`}
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {dropdownOpen && (
                    <div className="app-wallet-menu" role="menu">
                      <div className="app-wallet-menu-info">
                        <span className="app-wallet-menu-label">
                          Connected as
                        </span>
                        <span className="app-wallet-menu-address">
                          {account}
                        </span>
                      </div>
                      <div className="app-wallet-menu-divider" />
                      <button
                        className="app-wallet-menu-item app-wallet-menu-item-danger"
                        onClick={() => {
                          setDropdownOpen(false);
                          disconnectWallet();
                        }}
                        role="menuitem"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                          <polyline points="16 17 21 12 16 7" />
                          <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        Disconnect wallet
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  className="btn btn-primary btn-sm app-wallet-connect"
                  onClick={connectWallet}
                >
                  <WalletIcon size={12} />
                  Connect Wallet
                </button>
              )}
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Header;
