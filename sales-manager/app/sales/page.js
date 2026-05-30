'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const emptyForm = { member_id: '', phone: '', product_id: '', channel_id: '', quantity: 1, note: '' }

export default function SalesInput() {
  const [form, setForm] = useState(emptyForm)
  const [products, setProducts] = useState([])
  const [channels, setChannels] = useState([])
  const [members, setMembers] = useState([])
  const [memberSuggestions, setMemberSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)

  useEffect(() => {
    async function load() {
      const [{ data: p }, { data: c }, { data: m }] = await Promise.all([
        supabase.from('products').select('*').order('id'),
        supabase.from('channels').select('*').order('id'),
        supabase.from('members').select('*').order('name'),
      ])
      setProducts(p || [])
      setChannels(c || [])
      setMembers(m || [])
    }
    load()
  }, [])

  function handlePhoneChange(e) {
    const val = e.target.value
    setForm(p => ({ ...p, phone: val, member_id: '' }))
    setSelectedMember(null)
    if (val.length >= 2) {
      setMemberSuggestions(members.filter(m => m.phone.includes(val) || m.name.includes(val)))
    } else {
      setMemberSuggestions([])
    }
  }

  function selectMember(m) {
    setSelectedMember(m)
    setForm(p => ({ ...p, member_id: m.id, phone: m.phone }))
    setMemberSuggestions([])
  }

  function handleProductChange(e) {
    const id = e.target.value
    setForm(p => ({ ...p, product_id: id }))
    setSelectedProduct(products.find(p => p.id == id) || null)
  }

  const totalPrice = selectedProduct ? selectedProduct.price * Number(form.quantity) : 0

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.member_id) return toast.error('회원을 선택하세요.')
    if (!form.product_id) return toast.error('상품을 선택하세요.')
    if (!form.channel_id) return toast.error('구매 채널을 선택하세요.')
    setLoading(true)
    const { error } = await supabase.from('sales').insert({
      member_id: form.member_id,
      product_id: Number(form.product_id),
      channel_id: Number(form.channel_id),
      quantity: Number(form.quantity),
      total_price: totalPrice,
      note: form.note || null,
    })
    setLoading(false)
    if (error) { toast.error('저장 실패: ' + error.message); return }
    toast.success('판매가 등록되었습니다!')
    setForm(emptyForm)
    setSelectedMember(null)
    setSelectedProduct(null)
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">판매 입력</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 flex flex-col gap-5">

        {/* 회원 검색 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">회원 검색 <span className="text-red-500">*</span></label>
          <div className="relative">
            <input
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="이름 또는 휴대폰 번호 입력"
              value={form.phone}
              onChange={handlePhoneChange}
            />
            {memberSuggestions.length > 0 && (
              <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto">
                {memberSuggestions.map(m => (
                  <li
                    key={m.id}
                    className="px-4 py-2 hover:bg-indigo-50 cursor-pointer text-sm flex justify-between"
                    onClick={() => selectMember(m)}
                  >
                    <span className="font-medium">{m.name}</span>
                    <span className="text-gray-400">{m.phone}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {selectedMember && (
            <div className="mt-2 bg-indigo-50 rounded-lg px-3 py-2 text-sm flex items-center justify-between">
              <span>✅ <strong>{selectedMember.name}</strong> ({selectedMember.phone})</span>
              <button type="button" onClick={() => { setSelectedMember(null); setForm(p => ({ ...p, member_id: '', phone: '' })) }} className="text-gray-400 hover:text-red-400 ml-2">✕</button>
            </div>
          )}
        </div>

        {/* 구매 채널 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">구매 채널 <span className="text-red-500">*</span></label>
          <div className="flex flex-wrap gap-2">
            {channels.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setForm(p => ({ ...p, channel_id: c.id }))}
                className={`px-4 py-2 rounded-full text-sm border transition ${
                  form.channel_id == c.id
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* 상품 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">상품 <span className="text-red-500">*</span></label>
          <select
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            value={form.product_id}
            onChange={handleProductChange}
          >
            <option value="">상품 선택</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name} — {p.price.toLocaleString()}원</option>
            ))}
          </select>
        </div>

        {/* 수량 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">수량</label>
          <input
            type="number"
            min={1}
            className="w-24 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            value={form.quantity}
            onChange={e => setForm(p => ({ ...p, quantity: Math.max(1, Number(e.target.value)) }))}
          />
        </div>

        {/* 메모 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="선택 입력"
            value={form.note}
            onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
          />
        </div>

        {/* 합계 */}
        {totalPrice > 0 && (
          <div className="bg-indigo-50 rounded-lg px-4 py-3 flex justify-between text-sm">
            <span className="text-gray-600">결제 금액</span>
            <span className="font-bold text-indigo-700 text-base">{totalPrice.toLocaleString()}원</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {loading ? '저장 중...' : '판매 등록'}
        </button>
      </form>
    </div>
  )
}
