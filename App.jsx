import React, { useState, useEffect } from 'react';
import PetKnowledge from './components/PetKnowledge';
import ArticleView from './components/ArticleView';
import AuthModal from './components/AuthModal'; 
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

// 📝 ၁။ ADOPTION FORM COMPONENT (Internal)
function AdoptionFormInternal({ petName, currentUser, onBack, onSuccess }) {
  const [formData, setFormData] = useState({
    fullName: currentUser?.displayName || '',
    phone: '',
    address: '',
    houseType: 'တိုက်ခန်း/ကွန်ဒို',
    hasPets: 'မရှိဖူးပါ',
    reason: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.phone.trim() || !formData.address.trim() || !formData.reason.trim()) {
      alert("⚠️ ကျေးဇူးပြု၍ လိုအပ်သော အချက်အလက်များကို အကုန်ဖြည့်ပေးပါဗျာ။");
      return;
    }
    alert(`🎉 အောင်မြင်ပါသည်။ ${petName} လေးကို မွေးစားရန် လျှောက်လွှာတင်ပြီးပါပြီ။`);
    onSuccess();
  };

  return (
    <div className="max-w-2xl mx-auto my-8 px-4">
      <button onClick={onBack} className="bg-slate-700 hover:bg-slate-950 text-white font-bold px-5 py-2 rounded-full text-sm mb-6 shadow-md">
        ← ရှေ့စာမျက်နှာသို့ပြန်သွားရန်
      </button>

      <div className="bg-white rounded-[35px] shadow-2xl border border-orange-100 overflow-hidden">
        <div className="bg-gradient-to-r from-[#f97316] to-[#ea580c] p-6 text-center text-white">
          <span className="text-4xl">📝</span>
          <h2 className="text-2xl font-black mt-2">မွေးစားခြင်းဆိုင်ရာ လျှောက်လွှာဖောင်</h2>
          <p className="text-orange-100 text-xs font-bold mt-1">({petName} လေးအတွက် အချက်အလက်ဖြည့်ရန်)</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          <div>
            <label className="block text-slate-700 font-black text-sm mb-2">👤 လျှောက်ထားသူ အမည်</label>
            <input type="text" value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} placeholder="သင့်အမည် အပြည့်အစုံ" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-[15px] font-semibold text-slate-700 focus:outline-none focus:border-orange-500" />
          </div>

          <div>
            <label className="block text-slate-700 font-black text-sm mb-2">📞 ဖုန်းနံပါတ် *</label>
            <input type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="09xxxxxxxxx" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-[15px] font-semibold text-slate-700 focus:outline-none focus:border-orange-500" required />
          </div>

          <div>
            <label className="block text-slate-700 font-black text-sm mb-2">📍 နေရပ်လိပ်စာ *</label>
            <textarea value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} rows="2" placeholder="အိမ်အမှတ်၊ လမ်း၊ မြို့နယ်" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-[15px] font-semibold text-slate-700 focus:outline-none focus:border-orange-500 resize-none" required></textarea>
          </div>

          <div>
            <label className="block text-slate-700 font-black text-sm mb-2">🏠 အိမ်အမျိုးအစား</label>
            <select value={formData.houseType} onChange={(e) => setFormData({...formData, houseType: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-[15px] font-black text-slate-700">
              <option value="တိုက်ခန်း/ကွန်ဒို">🏢 တိုက်ခန်း / ကွန်ဒို</option>
              <option value="ခြံဝန်းနှင့်လုံးချင်းအိမ်">🏡 ခြံဝန်းနှင့် လုံးချင်းအိမ်</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-black text-sm mb-2">💝 အခြေအနေကို ရေးပေးပါနော်... *</label>
            <textarea value={formData.reason} onChange={(e) => setFormData({...formData, reason: e.target.value})} rows="3" placeholder="ဘာကြောင့် မွေးစားချင်တာလဲဗျာ..." className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-[15px] font-semibold text-slate-700 focus:outline-none focus:border-orange-500 resize-none" required></textarea>
          </div>

          <button type="submit" className="w-full bg-[#ff6b00] hover:bg-[#e55d00] text-white font-black p-4 rounded-[15px] shadow-lg text-base mt-4">
            လျှောက်လွှာဖောင် တင်သွင်းမည် 🚀
          </button>
        </form>
      </div>
    </div>
  );
}

// 👤 ၂။ MAIN APP COMPONENT
function App() {
  const [viewState, setViewState] = useState('home'); 
  const [selectedCategory, setSelectedCategory] = useState('dog'); 
  const [selectedArticleType, setSelectedArticleType] = useState('dogCare');
  const [selectedPetName, setSelectedPetName] = useState(''); 

  const [currentUser, setCurrentUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = () => {
    signOut(auth);
    alert("Logged out successfully!");
    setViewState('home');
  };

  // 🌟 Navbar က နှိပ်ရင် သက်ဆိုင်ရာ စာမျက်နှာဆီ scroll ရွှေ့ပေးမည့် လုပ်ဆောင်ချက်
  const scrollToSection = (id) => {
    setViewState('home'); // အရင်ဆုံး Home Page ဆီ ပြန်ပို့ပေးမယ်
    setTimeout(() => {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f1f5f9] via-[#e2e8f0] to-[#cbd5e1] font-sans flex flex-col m-0 p-0 overflow-x-hidden">
      
      {/* NAVIGATION BAR */}
      <nav className="w-full flex justify-between items-center px-12 py-5 bg-gradient-to-r from-[#f97316] via-[#ea580c] to-[#c2410c] shadow-lg z-30 fixed top-0 left-0">
        <div className="flex items-center gap-2 text-2xl font-black text-white cursor-pointer" onClick={() => setViewState('home')}>
          <span className="text-3xl filter drop-shadow-md">🐾</span> PetNests
        </div>
        <ul className="flex gap-10 text-lg font-bold text-white/90">
          <li className="hover:text-white cursor-pointer transition" onClick={() => setViewState('home')}>ပင်မစာမျက်နှာ</li>
          <li className="hover:text-white cursor-pointer transition" onClick={() => scrollToSection('about-us')}>ကျွန်ုပ်တို့အကြောင်း</li>
          <li className="hover:text-white cursor-pointer transition" onClick={() => scrollToSection('articles')}>ဗဟုသုတဆောင်းပါးများ</li>
          <li className="hover:text-white cursor-pointer transition" onClick={() => scrollToSection('contact')}>ဆက်သွယ်ရန်</li>
        </ul>
        
        {currentUser ? (
          <div className="flex items-center gap-4">
            <span className="text-white font-bold text-sm bg-black/20 px-4 py-1.5 rounded-full">👤 {currentUser.email}</span>
            <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 text-white font-black px-6 py-2 rounded-full text-sm shadow-md transition">ထွက်ရန်</button>
          </div>
        ) : (
          <button onClick={() => setShowAuthModal(true)} className="bg-white text-[#ea580c] font-black px-8 py-2.5 rounded-full shadow-md text-base transition">အကောင့်ဝင်ရန်</button>
        )}
      </nav>

      <div className="mt-[80px]"></div>

      {/* Main App Display Views */}
      <div className="flex-grow">
        
        {/* VIEW 1: HOME PAGE */}
        {viewState === 'home' && (
          <>
            <header className="relative w-full h-[520px] flex flex-col items-center justify-center text-center px-6 border-b-[8px] border-[#ea580c]/80 shadow-2xl">
              <img src="https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=1200&auto=format&fit=crop" alt="Bg" className="absolute inset-0 w-full h-full object-cover z-0 brightness-[0.60]" />
              <div className="max-w-4xl bg-black/40 p-8 rounded-3xl backdrop-blur-md border border-white/20 shadow-2xl z-10 mb-12">
                <h1 className="text-4xl md:text-5xl font-black text-white leading-tight">PetNests နှင့်အတူ သင့်ရဲ့အချစ်ဆုံး သူငယ်ချင်းအသစ်လေးကို ရှာဖွေပြီး မွေးစားလိုက်ပါ။</h1>
              </div>

              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 w-full max-w-lg px-6 grid grid-cols-2 gap-8 z-20">
                <div onClick={() => { setSelectedCategory('dog'); setViewState('gallery'); }} className="bg-white border-2 border-orange-500 rounded-[35px] p-6 shadow-2xl cursor-pointer text-center group flex flex-col items-center h-40 justify-center transform hover:-translate-y-2 transition-all">
                  <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center text-4xl">🐶</div>
                  <span className="text-xl font-black text-slate-800 mt-3">ခွေးလေးများ</span>
                </div>
                <div onClick={() => { setSelectedCategory('cat'); setViewState('gallery'); }} className="bg-white border-2 border-orange-500 rounded-[35px] p-6 shadow-2xl cursor-pointer text-center group flex flex-col items-center h-40 justify-center transform hover:-translate-y-2 transition-all">
                  <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center text-4xl">🐱</div>
                  <span className="text-xl font-black text-slate-800 mt-3">ကြောင်လေးများ</span>
                </div>
              </div>
            </header>

            <div className="mt-36"></div>

            {/* 🌟 ကျွန်ုပ်တို့အကြောင်း (ABOUT US SECTION) */}
            <section id="about-us" className="w-full max-w-6xl mx-auto px-6 py-12 scroll-mt-24">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center bg-white p-8 rounded-[40px] shadow-xl">
                <div className="space-y-6">
                  <h3 className="text-2xl font-black text-[#ea580c]">🏡 ကျွန်ုပ်တို့အကြောင်း (About Us)</h3>
                  <h4 className="text-xl font-black text-slate-800">နွေးထွေးတဲ့ အိမ်ဂေဟာလေးများ ဖန်တီးပေးခြင်း</h4>
                  <p className="text-slate-600 text-lg leading-relaxed font-semibold">PetNests သည် လမ်းဘေးရောက် ကယ်ဆယ်ထားသော တိရစ္ဆာန်လေးများကို စနစ်တကျ ပြန်လည်မွေးစားနိုင်ရန်နှင့် မေတ္တာစစ်ဖြင့် စောင့်ရှောက်မည့် အိမ်ရှင်များနှင့် ချိတ်ဆက်ပေးသည့် ပလက်ဖောင်းဖြစ်ပါသည်။</p>
                </div>
                <div className="h-[340px] rounded-[30px] overflow-hidden"><img src="https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?q=80&w=600&auto=format&fit=crop" alt="Dog" className="w-full h-full object-cover" /></div>
              </div>
            </section>

            {/* 🌟 ဗဟုသုတဆောင်းပါးများ (ARTICLES SECTION) */}
            <section id="articles" className="w-full max-w-6xl mx-auto px-6 py-12 scroll-mt-24">
              <h2 className="text-3xl font-black text-slate-800 text-center mb-8">💡 အိမ်မွေးတိရစ္ဆာန်ဆိုင်ရာ ဗဟုသုတဆောင်းပါးများ</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* ကတ် ၁ - ခွေးပြုစုနည်း */}
                <div className="bg-white p-6 rounded-[30px] shadow-xl border border-slate-100 flex flex-col justify-between">
                  <div>
                    <span className="text-4xl">🍖</span>
                    <h3 className="text-xl font-black text-slate-800 mt-3 mb-2">ခွေးလေးများအား စနစ်တကျ ပြုစုစောင့်ရှောက်နည်း</h3>
                    <p className="text-slate-500 font-semibold text-sm mb-4">ခွေးလေးတွေ ကျန်းမာရွှင်လန်းစေဖို့ အစားအစာကျွေးမွေးပုံနဲ့ ကာကွယ်ဆေးထိုးနှံခြင်းဆိုင်ရာ သိကောင်းစရာများ...</p>
                  </div>
                  <button onClick={() => { setSelectedArticleType('dogCare'); setViewState('article'); }} className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 px-6 rounded-full text-sm self-start transition">ဖတ်ရှုရန် →</button>
                </div>

                {/* ကတ် ၂ - ကြောင်ပြုစုနည်း */}
                <div className="bg-white p-6 rounded-[30px] shadow-xl border border-slate-100 flex flex-col justify-between">
                  <div>
                    <span className="text-4xl">🐟</span>
                    <h3 className="text-xl font-black text-slate-800 mt-3 mb-2">ကြောင်လေးများအတွက် အခြေခံသိကောင်းစရာများ</h3>
                    <p className="text-slate-500 font-semibold text-sm mb-4">ကြောင်လေးတွေရဲ့ သဘာဝ စရိုက်လက္ခဏာများနှင့် အိမ်တွင်းမှာ စိတ်ပျော်ရွှင်အောင် မွေးမြူနည်းလမ်းကောင်းများ...</p>
                  </div>
                  <button onClick={() => { setSelectedArticleType('catCare'); setViewState('article'); }} className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 px-6 rounded-full text-sm self-start transition">ဖတ်ရှုရန် →</button>
                </div>
              </div>
            </section>
          </>
        )}

        {/* VIEW 2: PET GALLERY PAGE */}
        {viewState === 'gallery' && (
          <div className="py-6">
            <PetKnowledge 
              category={selectedCategory} 
              onBack={() => setViewState('home')} 
              currentUser={currentUser}
              onRequireAuth={() => setShowAuthModal(true)}
              onNavigateToForm={(petName) => {
                setSelectedPetName(petName); 
                setViewState('adoptionForm'); 
              }}
            />
          </div>
        )}

        {/* VIEW 3: ARTICLE DETAILS PAGE */}
        {viewState === 'article' && (
          <div className="py-6"><ArticleView type={selectedArticleType} onBack={() => setViewState('home')} /></div>
        )}

        {/* VIEW 4: ADOPTION APPLICATION FORM PAGE */}
        {viewState === 'adoptionForm' && (
          <div className="py-6">
            <AdoptionFormInternal 
              petName={selectedPetName}
              currentUser={currentUser}
              onBack={() => setViewState('gallery')} 
              onSuccess={() => setViewState('home')} 
            />
          </div>
        )}

      </div>

      {/* SIGNUP / LOGIN MODAL POPUP */}
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} onAuthSuccess={() => console.log("Logged In")} />
      )}

      {/* 🌟 ဆက်သွယ်ရန် (CONTACT & FOOTER) */}
      <footer id="contact" className="w-full bg-[#0f172a] text-slate-300 pt-16 pb-8 px-12 border-t-8 border-[#ea580c] scroll-mt-24">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div>
            <h3 className="text-white font-black text-xl mb-4">🐾 PetNests</h3>
            <p className="text-sm text-slate-400 font-semibold">တိရစ္ဆာန်လေးတွေရဲ့ ဘဝအသစ်ကို အတူတူ ဖန်တီးပေးကြပါစို့။</p>
          </div>
          <div>
            <h3 className="text-white font-black text-lg mb-4">📞 ဆက်သွယ်ရန်</h3>
            <p className="text-sm text-slate-400 font-semibold">ဖုန်း - 09-123456789</p>
            <p className="text-sm text-slate-400 font-semibold">အီးမေးလ် - info@petnests.com</p>
          </div>
          <div>
            <h3 className="text-white font-black text-lg mb-4">📍 တည်နေရာ</h3>
            <p className="text-sm text-slate-400 font-semibold">ရန်ကုန်မြို့၊ မြန်မာနိုင်ငံ။</p>
          </div>
        </div>
        <div className="max-w-6xl mx-auto pt-8 border-t border-slate-800 text-center text-xs text-slate-500">© 2026 PetNests. All rights reserved.</div>
      </footer>

    </div>
  );
}

export default App;