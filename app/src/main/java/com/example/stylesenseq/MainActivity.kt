package com.example.stylesenseq

import android.R
import android.os.Bundle
import android.view.View
import android.widget.ImageButton

class MainActivity : AppCompatActivity() {
    private var navOverlay: View? = null
    private var btnMenu: ImageButton? = null
    private var btnNavClose: ImageButton? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        navOverlay = findViewById<View>(R.id.nav_overlay)
        btnMenu = findViewById<ImageButton>(R.id.btn_menu)
        btnNavClose = navOverlay!!.findViewById<ImageButton>(R.id.btn_nav_close)

        btnMenu!!.setOnClickListener(View.OnClickListener { v: View? ->
            navOverlay!!.setVisibility(
                View.VISIBLE
            )
        })
        btnNavClose.setOnClickListener(View.OnClickListener { v: View? ->
            navOverlay!!.setVisibility(
                View.GONE
            )
        })
    }

    override fun onBackPressed() {
        if (navOverlay!!.getVisibility() == View.VISIBLE) {
            navOverlay!!.setVisibility(View.GONE)
        } else {
            super.onBackPressed()
        }
    }
}