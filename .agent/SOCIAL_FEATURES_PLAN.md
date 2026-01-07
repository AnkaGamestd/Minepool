# Mine Pool - Social Features Plan

## Phase 1: Core Social Features ✅ (Completed)

### Friends System
- [x] Friends page (`friends.html`)
- [x] View friends list with online/offline status
- [x] Incoming/sent friend requests management
- [x] Recent opponents list
- [x] Player search functionality
- [x] Player profile modal (`player-profile-viewer.js`)

### Social Actions
- [x] Add Friend button
- [x] Challenge Friend button
- [x] Send Gift button (coins)
- [x] View player profile

---

## Phase 2: In-Game Social Integration (In Progress)

### Opponent Profile Access
- [ ] Make opponent avatar clickable during game
- [ ] Show player profile modal with stats
- [ ] Add Friend directly from game
- [ ] Challenge to rematch after game

### Navigation Integration
- [ ] Add Friends button to bottom navigation bar
- [ ] Quick access from profile page

---

## Phase 3: Enhanced Social Features (Planned)

### 1. Clubs/Guilds System
- Create or join clubs with other players
- Club chat and announcements
- Club leaderboards
- Weekly club challenges
- Club vs Club tournaments

### 2. Chat System
- Global chat rooms (Main Hall, Beginner, Pro)
- Private messaging between friends
- Quick chat emojis in-game
- Chat moderation and reporting

### 3. Spectator Mode
- Watch friends play live
- Spectator count display
- Live reactions from spectators
- Spectator betting (virtual)

### 4. Social Challenges
- Daily challenges with friends
- Head-to-head challenge streaks
- Weekly friend tournaments
- Challenge rewards

### 5. Leaderboards
- Friend leaderboards (rank among friends)
- Global leaderboards
- Monthly/weekly resets
- Rewards for top positions

### 6. Player Interaction
- Block/Mute players
- Report inappropriate behavior
- Favorite players
- Player notes

### 7. Notifications
- Challenge received notifications
- Friend request notifications
- Gift received notifications
- Friend online notifications
- Club activity notifications

### 8. Activity Feed
- See what friends are doing
- Recent wins/losses
- Achievements unlocked
- Level ups
- Tournaments joined

### 9. Social Rewards
- Referral system (invite friends)
- Daily login bonus for active friends
- Social achievements
- Friend milestone rewards

### 10. Tournaments with Friends
- Create private tournaments
- Invite friends to compete
- Tournament spectating
- Prize pool contributions

---

## Backend API Requirements

### Friends API Endpoints
```
GET    /api/friends              - Get friends list
POST   /api/friends/request      - Send friend request
POST   /api/friends/accept/:id   - Accept friend request
POST   /api/friends/decline/:id  - Decline friend request
DELETE /api/friends/:id          - Remove friend
POST   /api/friends/gift         - Send gift to friend
```

### User Search API
```
GET    /api/users/search?q=      - Search users by username
GET    /api/users/:id            - Get user profile
```

### Challenge API (WebSocket)
```
challenge:send      - Send challenge to player
challenge:accept    - Accept challenge
challenge:decline   - Decline challenge
challenge:cancel    - Cancel sent challenge
```

---

## Priority Order

1. ⏳ **Phase 2** - In-Game Social Integration
2. 🔜 Chat System (Quick wins)
3. 🔜 Notifications
4. 📅 Clubs/Guilds (Major feature)
5. 📅 Spectator Mode
6. 📅 Activity Feed

---

## Notes

- All social features should work with the existing auth system
- Friend data should persist in users.json
- Consider rate limiting for friend requests
- Add friend request cooldown per player
