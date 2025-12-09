"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Menu,
  X,
  ShoppingCart,
  Search,
  User,
  ChevronDown,
  LogOut,
  Heart,
  Package,
} from "lucide-react";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import catalogService, { CatalogCategory } from "@/services/catalogService";
import cartService from "@/services/cartService";

const BRAND = "ERRUM";

const Navbar = () => {
  const router = useRouter();
  const { customer, isAuthenticated, logout } = useCustomerAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const data = await catalogService.getCategories();
      setCategories(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load categories");
      console.error("Error fetching categories:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCartCount = async () => {
    try {
      const summary = await cartService.getCartSummary();
      setCartCount(summary.total_items || 0);
    } catch (err: any) {
      console.error("Error fetching cart count:", err);
      setCartCount(0);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchCartCount();
  }, []);

  // Close user dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleMobileMenu = () => setIsOpen(!isOpen);

  const handleDropdownToggle = (categoryId: number) => {
    setActiveDropdown(activeDropdown === categoryId ? null : categoryId);
  };

  const handleLogout = async () => {
    try {
      setShowUserDropdown(false);
      await logout();
      router.push("/e-commerce");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-[68px]">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/e-commerce" className="flex items-center gap-2">
              <span className="text-[22px] sm:text-2xl font-bold tracking-tight text-gray-900">
                {BRAND.slice(0, 2)}
                <span className="text-red-700">{BRAND.slice(2)}</span>
              </span>
              <span className="hidden sm:inline-flex text-[10px] tracking-widest uppercase text-gray-400 mt-1">
                Sarees
              </span>
            </Link>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="/e-commerce"
              className="text-sm font-medium text-gray-700 hover:text-red-700 transition"
            >
              Home
            </Link>

            {/* Categories Dropdown */}
            <div className="relative group">
              <button
                className="text-sm font-medium text-gray-700 hover:text-red-700 transition flex items-center gap-1"
                type="button"
              >
                Categories
                <ChevronDown className="h-4 w-4 opacity-70 group-hover:opacity-100 transition" />
              </button>

              {!loading && categories.length > 0 && (
                <div className="absolute left-0 mt-3 w-64 rounded-2xl bg-white shadow-xl ring-1 ring-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                  <div className="p-2">
                    {categories.map((category) => (
                      <Link
                        key={category.id}
                        href={`/e-commerce/${encodeURIComponent(category.name)}`}
                        className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 transition"
                      >
                        <span>{category.name}</span>
                        {category.product_count > 0 && (
                          <span className="text-[10px] text-gray-500">
                            {category.product_count}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Keep your current routes intact */}
            <Link
              href="/e-commerce/about"
              className="text-sm font-medium text-gray-700 hover:text-red-700 transition"
            >
              About
            </Link>
            <Link
              href="/e-commerce/contact"
              className="text-sm font-medium text-gray-700 hover:text-red-700 transition"
            >
              Contact
            </Link>
          </div>

          {/* Right Icons */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/e-commerce/search"
              className="p-2 rounded-lg hover:bg-gray-50 text-gray-700 hover:text-red-700 transition"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </Link>

            <Link
              href="/e-commerce/wishlist"
              className="p-2 rounded-lg hover:bg-gray-50 text-gray-700 hover:text-red-700 transition"
              aria-label="Wishlist"
            >
              <Heart className="h-5 w-5" />
            </Link>

            {/* User Dropdown */}
            {isAuthenticated ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowUserDropdown((p) => !p)}
                  className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-3 py-1.5 shadow-sm hover:shadow transition"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 text-white text-xs font-semibold">
                    {customer?.name?.[0]?.toUpperCase() || "U"}
                  </span>
                  <span className="text-xs font-medium text-gray-800 max-w-[110px] truncate">
                    {customer?.name || "Account"}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-gray-500 transition ${
                      showUserDropdown ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {showUserDropdown && (
                  <div className="absolute right-0 mt-3 w-56 rounded-2xl bg-white shadow-xl ring-1 ring-gray-100 py-2 z-50">
                    <Link
                      href="/e-commerce/my-account"
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 transition"
                      onClick={() => setShowUserDropdown(false)}
                    >
                      <User className="h-4 w-4" />
                      My Account
                    </Link>
                    <Link
                      href="/e-commerce/orders"
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 transition"
                      onClick={() => setShowUserDropdown(false)}
                    >
                      <Package className="h-4 w-4" />
                      Orders
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 transition"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/e-commerce/login"
                className="text-sm font-semibold text-gray-900 hover:text-red-700 transition"
              >
                Login
              </Link>
            )}

            {/* Cart */}
            <Link
              href="/e-commerce/cart"
              className="relative p-2 rounded-lg hover:bg-gray-50 text-gray-700 hover:text-red-700 transition"
              aria-label="Cart"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-700 text-white text-[10px] rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>
          </div>

          {/* Mobile Toggle */}
          <button
            onClick={toggleMobileMenu}
            className="md:hidden p-2 rounded-lg hover:bg-gray-50 transition"
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white">
          <div className="max-w-7xl mx-auto px-4 py-4 space-y-2">
            <Link
              href="/e-commerce"
              className="block rounded-xl px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
              onClick={() => setIsOpen(false)}
            >
              Home
            </Link>

            {/* Mobile Categories */}
            <div className="rounded-xl border border-gray-100">
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800">
                  Categories
                </span>
              </div>
              <div className="px-2 pb-2">
                {loading && (
                  <div className="px-2 py-2 text-xs text-gray-500">
                    Loading...
                  </div>
                )}
                {error && (
                  <div className="px-2 py-2 text-xs text-red-600">{error}</div>
                )}
                {!loading &&
                  !error &&
                  categories.map((category) => (
                    <div key={category.id} className="rounded-lg">
                      <button
                        type="button"
                        onClick={() => handleDropdownToggle(category.id)}
                        className="w-full flex items-center justify-between rounded-lg px-2 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <span className="flex items-center gap-2">
                          {category.name}
                          {category.product_count > 0 && (
                            <span className="text-[10px] text-gray-500">
                              ({category.product_count})
                            </span>
                          )}
                        </span>
                        <ChevronDown
                          className={`h-4 w-4 transition ${
                            activeDropdown === category.id ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      {/* children if exist */}
                      {activeDropdown === category.id &&
                        category.children &&
                        category.children.length > 0 && (
                          <div className="ml-2 mb-1">
                            {category.children.map((child) => (
                              <Link
                                key={child.id}
                                href={`/e-commerce/${encodeURIComponent(
                                  child.name
                                )}`}
                                className="block rounded-lg px-3 py-1.5 text-xs text-gray-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() => setIsOpen(false)}
                              >
                                {child.name}
                              </Link>
                            ))}
                          </div>
                        )}
                    </div>
                  ))}
              </div>
            </div>

            {/* Keep your existing paths */}
            <Link
              href="/e-commerce/about"
              className="block rounded-xl px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
              onClick={() => setIsOpen(false)}
            >
              About
            </Link>
            <Link
              href="/e-commerce/contact"
              className="block rounded-xl px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
              onClick={() => setIsOpen(false)}
            >
              Contact
            </Link>

            <div className="pt-2 flex items-center gap-3">
              <Link
                href="/e-commerce/search"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-100 px-3 py-2 text-xs font-semibold text-gray-800"
                onClick={() => setIsOpen(false)}
              >
                <Search className="h-4 w-4" />
                Search
              </Link>
              <Link
                href="/e-commerce/wishlist"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-100 px-3 py-2 text-xs font-semibold text-gray-800"
                onClick={() => setIsOpen(false)}
              >
                <Heart className="h-4 w-4" />
                Wishlist
              </Link>
              <Link
                href="/e-commerce/cart"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-100 px-3 py-2 text-xs font-semibold text-gray-800"
                onClick={() => setIsOpen(false)}
              >
                <ShoppingCart className="h-4 w-4" />
                Cart
                {cartCount > 0 && (
                  <span className="ml-1 rounded-full bg-red-700 text-white px-1.5 py-0.5 text-[10px]">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
