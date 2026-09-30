import React from "react";
import { FiX, FiPrinter, FiCheckCircle, FiShield } from "react-icons/fi";

export default function InvoiceModal({
    isOpen,
    onClose,
    booking,
    clientName,
    companionName
}) {
    if (!isOpen || !booking) return null;

    const invoiceNumber = `INV-${new Date(booking.created_at || Date.now()).getFullYear()}-${String(booking.id || 101).padStart(5, '0')}`;
    const issueDate = new Date(booking.created_at || Date.now()).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });

    const hours = booking.hours || 1;
    const baseAmount = booking.amount || 1000;
    const platformFee = Math.round(baseAmount * 0.05);
    const totalAmount = baseAmount + platformFee;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto print:p-0 print:bg-white">
            <div className="relative w-full max-w-2xl bg-[#141428] border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl my-8 text-left text-white print:bg-white print:text-black print:border-none print:shadow-none print:m-0 print:w-full">
                {/* Close and Print Bar */}
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10 print:hidden">
                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-bold flex items-center gap-1.5">
                            <FiCheckCircle size={12} /> Paid & Verified
                        </span>
                        <span className="text-xs text-gray-400 font-mono">{invoiceNumber}</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl text-xs font-bold transition hover:opacity-90 flex items-center gap-1.5 shadow-md"
                        >
                            <FiPrinter size={14} /> Print / Save PDF
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition"
                        >
                            <FiX size={18} />
                        </button>
                    </div>
                </div>

                {/* ─── INVOICE BODY ─── */}
                <div className="space-y-6">
                    {/* Brand Header */}
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-black bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 bg-clip-text text-transparent print:text-black">
                                Coffeely
                            </h2>
                            <p className="text-xs text-gray-400 print:text-gray-600">Premier Verified Companion Platform</p>
                            <p className="text-[11px] text-gray-500 print:text-gray-600">https://coffeely-app.vercel.app</p>
                        </div>
                        <div className="text-right">
                            <h3 className="text-base font-bold text-gray-200 print:text-black uppercase tracking-wider">Tax Invoice</h3>
                            <p className="text-xs font-mono text-pink-400 print:text-black font-bold">{invoiceNumber}</p>
                            <p className="text-[11px] text-gray-400 print:text-gray-600">Date: {issueDate}</p>
                        </div>
                    </div>

                    {/* Parties Section */}
                    <div className="grid grid-cols-2 gap-4 bg-[#181832] p-4 rounded-2xl border border-white/5 print:bg-gray-50 print:border-gray-200">
                        <div>
                            <span className="text-[10px] uppercase font-bold text-gray-400 print:text-gray-600 block mb-1">Billed To (Client)</span>
                            <div className="font-bold text-sm text-white print:text-black">{clientName || "Client"}</div>
                            <div className="text-xs text-gray-400 print:text-gray-600">Verified Member</div>
                        </div>
                        <div>
                            <span className="text-[10px] uppercase font-bold text-gray-400 print:text-gray-600 block mb-1">Service Companion</span>
                            <div className="font-bold text-sm text-white print:text-black">{companionName || "Companion"}</div>
                            <div className="text-xs text-gray-400 print:text-gray-600">Verified Companion Partner</div>
                        </div>
                    </div>

                    {/* Booking Details Summary */}
                    <div className="bg-[#181832] p-4 rounded-2xl border border-white/5 print:bg-gray-50 print:border-gray-200">
                        <span className="text-[10px] uppercase font-bold text-gray-400 print:text-gray-600 block mb-2">Session Particulars</span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                            <div>
                                <span className="text-gray-500 block text-[10px]">Date</span>
                                <span className="font-semibold text-gray-200 print:text-black">{booking.meeting_date || "Scheduled Date"}</span>
                            </div>
                            <div>
                                <span className="text-gray-500 block text-[10px]">Time</span>
                                <span className="font-semibold text-gray-200 print:text-black">{booking.meeting_time || "Scheduled Time"}</span>
                            </div>
                            <div>
                                <span className="text-gray-500 block text-[10px]">Duration</span>
                                <span className="font-semibold text-gray-200 print:text-black">{hours} Hours Session</span>
                            </div>
                            <div className="col-span-2 sm:col-span-3">
                                <span className="text-gray-500 block text-[10px]">Location</span>
                                <span className="font-semibold text-gray-200 print:text-black">{booking.meeting_location || "Mutual Venue"}</span>
                            </div>
                        </div>
                    </div>

                    {/* Line Items Table */}
                    <div className="border border-white/10 rounded-2xl overflow-hidden print:border-gray-300">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-[#1F1F3D] text-gray-300 print:bg-gray-100 print:text-black font-bold">
                                <tr>
                                    <th className="py-3 px-4">Description</th>
                                    <th className="py-3 px-4 text-center">Qty / Duration</th>
                                    <th className="py-3 px-4 text-right">Unit Rate</th>
                                    <th className="py-3 px-4 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 print:divide-gray-200 text-gray-300 print:text-black">
                                <tr>
                                    <td className="py-3 px-4 font-semibold">
                                        Companion Session with {companionName || "Companion"}
                                    </td>
                                    <td className="py-3 px-4 text-center">{hours} hrs</td>
                                    <td className="py-3 px-4 text-right">₹{Math.round(baseAmount / hours).toLocaleString()}</td>
                                    <td className="py-3 px-4 text-right font-bold text-white print:text-black">₹{baseAmount.toLocaleString()}</td>
                                </tr>
                                <tr>
                                    <td className="py-3 px-4 font-semibold">
                                        Escrow Protection & Platform Safety Fee (5%)
                                    </td>
                                    <td className="py-3 px-4 text-center">1</td>
                                    <td className="py-3 px-4 text-right">₹{platformFee.toLocaleString()}</td>
                                    <td className="py-3 px-4 text-right font-bold text-white print:text-black">₹{platformFee.toLocaleString()}</td>
                                </tr>
                            </tbody>
                            <tfoot className="bg-[#181832] font-bold text-white print:bg-gray-100 print:text-black">
                                <tr>
                                    <td colSpan="3" className="py-3 px-4 text-right font-bold">Total Paid (INR):</td>
                                    <td className="py-3 px-4 text-right text-pink-400 print:text-black text-sm font-extrabold">₹{totalAmount.toLocaleString()}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Escrow Guarantee & Footer */}
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2 text-[11px] text-gray-400 print:text-gray-600">
                        <div className="flex items-center gap-2">
                            <FiShield className="text-purple-400" size={16} />
                            <span>100% Escrow Protected & Verified Transaction</span>
                        </div>
                        <div className="text-center sm:text-right font-mono text-[10px]">
                            Status: <strong className="text-emerald-400">ESCROW HELD</strong>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
