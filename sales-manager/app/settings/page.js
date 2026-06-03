'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

// 공급 원가 필드 관리 (상품별 확장 패널)
function SupplyFieldsPanel({ product }) {
  const [fields, setFields] = useState([])
  const [form, setForm] = useState({ field_name: '', amount: '' })
  const [editId, setEditId] = useState(null)

  async function fetchFields() {
    const { data } = await supabase
      .from('supply_fields')
      .select('*')
      .eq('product_id', product.id)
      .order('id')
    setFields(data || [])
  }

  useEffect(() => { fetchFields() }, [product.id])

  const supplyTotal = fields.reduce((s, f) => s + (f.amount || 0), 0)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.field_name.trim()) return toast.error('필드명을 입력하세요.')
    const payload = {
      product_id: product.id,
      field_name: form.field_name,
      amount: Number(form.amount) || 0,
    }
    if (editId) {
      const { error } = await supabase.from('supply_fields').update(payload).eq('id', editId)
      if (error) toast.error('수정 실패')
      else { toast.success('수정됨'); setEditId(null) }
    } else {
      const { error } = await supabase.from('supply_fields').insert(payload)
      if (error) toast.error('추가 실패: ' + error.message)
      else toast.success('필드 추가됨')
    }
    setForm({ field_name: '', amount: '' })
    fetchFields()
  }

  async function handleDelete(id) {
    if (!confirm('삭제할까요?')) return
    await supabase.from('supply_fields').delete().eq('id', id)
    toast.success('삭제됨')
    fetchFields()
  }

  return (
    <div className="mt-3 bg-gray-50 rounded-lg p-4 border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">공급 원가 필드</span>
        <span className="text-sm font-bold text-indigo-700">
          공급가 합계: {supplyTotal.toLocaleString()}원
        </span>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 mb-3">
        <input
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="필드명 (예: 원단비)"
          value={form.field_name}
          onChange={e => setForm(p => ({ ...p, field_name: e.target.value }))}
        />
        <input
          type="number"
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="금액 (원)"
          value={form.amount}
          onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
        />
        <button type="submit" className="bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-indigo-600 transition">
          {editId ? '수정 저장' : '+ 추가'}
        </button>
        {editId && (
          <button type="button" onClick={() => { setEditId(null); setForm({ field_name: '', amount: '' }) }}
            className="bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-300 transition">취소</button>
        )}
      </form>
      {fields.length === 0 ? (
        <p className="text-xs text-gray-400">공급 원가 필드가 없습니다. 위에서 추가해 주세요.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {fields.map(f => (
            <li key={f.id} className="py-1.5 flex items-center justify-between text-sm">
              <span className="text-gray-700">{f.field_name} <span className="text-gray-400 ml-1">{f.amount?.toLocaleString()}원</span></span>
              <div className="flex gap-2">
                <button onClick={() => { setEditId(f.id); setForm({ field_name: f.field_name, amount: f.amount }) }}
                  className="text-indigo-400 hover:underline text-xs">수정</button>
                <button onClick={() => handleDelete(f.id)} className="text-red-400 hover:underline text-xs">삭제</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ProductManager() {
  const [products, setProducts] = useState([])
  const [form, setForm] = useState({ name: '', price: '' })
  const [editId, setEditId] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  async function fetchProducts() {
    const { data } = await supabase.from('products').select('*').order('id')
    setProducts(data || [])
  }
  useEffect(() => { fetchProducts() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('이름을 입력하세요.')
    const payload = { name: form.name, price: Number(form.price) || 0 }
    if (editId) {
      const { error } = await supabase.from('products').update(payload).eq('id', editId)
      if (error) toast.error('수정 실패')
      else { toast.success('수정되었습니다.'); setEditId(null) }
    } else {
      const { error } = await supabase.from('products').insert(payload)
      if (error) toast.error('추가 실패: ' + error.message)
      else toast.success('추가되었습니다.')
    }
    setForm({ name: '', price: '' })
    fetchProducts()
  }

  async function handleDelete(id) {
    if (!confirm('삭제할까요?')) return
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) toast.error('삭제 실패')
    else { toast.success('삭제됨'); fetchProducts() }
  }

  return (
    <div className="bg-white rounded-xl shadow p-5">
      <h2 className="text-lg font-semibold text-gray-700 mb-4">상품 관리</h2>
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 mb-4">
        <input
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="상품 이름"
          value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
        />
        <input
          type="number"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="판매가 (원)"
          value={form.price}
          onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
        />
        <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition">
          {editId ? '수정 저장' : '추가'}
        </button>
        {editId && (
          <button type="button" onClick={() => { setEditId(null); setForm({ name: '', price: '' }) }}
            className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition">취소</button>
        )}
      </form>
      <ul className="divide-y">
        {products.map(item => (
          <li key={item.id} className="py-2">
            <div className="flex items-center justify-between text-sm">
              <button
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                className="flex items-center gap-1 text-left hover:text-indigo-600 transition"
              >
                <span className={`text-xs transition-transform ${expandedId === item.id ? 'rotate-90' : ''}`}>▶</span>
                <span className="font-medium">{item.name}</span>
                <span className="text-gray-400 ml-2">{item.price?.toLocaleString()}원</span>
              </button>
              <div className="flex gap-3">
                <button onClick={() => { setEditId(item.id); setForm({ name: item.name, price: item.price || '' }) }}
                  className="text-indigo-500 hover:underline text-xs">수정</button>
                <button onClick={() => handleDelete(item.id)} className="text-red-400 hover:underline text-xs">삭제</button>
              </div>
            </div>
            {expandedId === item.id && <SupplyFieldsPanel product={item} />}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ItemManager({ table, label }) {
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ name: '' })
  const [editId, setEditId] = useState(null)

  async function fetch_() {
    const { data } = await supabase.from(table).select('*').order('id')
    setItems(data || [])
  }
  useEffect(() => { fetch_() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('이름을 입력하세요.')
    const payload = { name: form.name }
    if (editId) {
      const { error } = await supabase.from(table).update(payload).eq('id', editId)
      if (error) toast.error('수정 실패')
      else { toast.success('수정되었습니다.'); setEditId(null) }
    } else {
      const { error } = await supabase.from(table).insert(payload)
      if (error) toast.error('추가 실패: ' + error.message)
      else toast.success('추가되었습니다.')
    }
    setForm({ name: '' })
    fetch_()
  }

  async function handleDelete(id) {
    if (!confirm('삭제할까요?')) return
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) toast.error('삭제 실패')
    else { toast.success('삭제됨'); fetch_() }
  }

  return (
    <div className="bg-white rounded-xl shadow p-5">
      <h2 className="text-lg font-semibold text-gray-700 mb-4">{label} 관리</h2>
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 mb-4">
        <input
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder={label + ' 이름'}
          value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
        />
        <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition">
          {editId ? '수정 저장' : '추가'}
        </button>
        {editId && (
          <button type="button" onClick={() => { setEditId(null); setForm({ name: '' }) }}
            className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition">취소</button>
        )}
      </form>
      <ul className="divide-y">
        {items.map(item => (
          <li key={item.id} className="py-2 flex items-center justify-between text-sm">
            <span>{item.name}</span>
            <div className="flex gap-3">
              <button onClick={() => { setEditId(item.id); setForm({ name: item.name }) }}
                className="text-indigo-500 hover:underline text-xs">수정</button>
              <button onClick={() => handleDelete(item.id)} className="text-red-400 hover:underline text-xs">삭제</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Settings() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">상품 / 채널 설정</h1>
      <div className="grid md:grid-cols-2 gap-6">
        <ProductManager />
        <ItemManager table="channels" label="구매 채널" />
      </div>
      <p className="mt-4 text-xs text-gray-400">
        💡 상품을 클릭하면 공급 원가 필드를 관리할 수 있습니다. 필드들의 합이 해당 상품의 공급가입니다.
      </p>
    </div>
  )
}
