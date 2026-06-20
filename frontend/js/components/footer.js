// js/components/footer.js
function renderFooter() {
    const footerHTML = `
        <footer class="footer">
            <div class="container">
                <div class="grid grid-4">
                    <div>
                        <h4>🐾 PetRehome</h4>
                        <p>Connecting pets with loving homes in Yangon and beyond.</p>
                    </div>
                    <div>
                        <h4>Quick Links</h4>
                        <ul class="footer-links">
                            <li><a href="#/">Home</a></li>
                            <li><a href="#/browse">Browse Pets</a></li>
                            <li><a href="#/blogs">Blog</a></li>
                            <li><a href="#/chat">PawBot</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4>Account</h4>
                        <ul class="footer-links">
                            <li><a href="#/login">Login</a></li>
                            <li><a href="#/register">Register</a></li>
                            <li><a href="#/profile">Profile</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4>Contact</h4>
                        <p>Email: support@petrehome.com</p>
                        <p>Location: Yangon, Myanmar</p>
                    </div>
                </div>
                <div class="footer-bottom">
                    <p>&copy; 2026 PetRehome. All rights reserved.</p>
                </div>
            </div>
        </footer>
    `;
    
    document.getElementById('footer').innerHTML = footerHTML;
}